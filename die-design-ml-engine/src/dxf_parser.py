"""
dxf_parser.py — DXF ingestion using ezdxf.

Reads a 2D die drawing (DXF) and extracts geometric primitives
(LINE, ARC, CIRCLE, LWPOLYLINE, SOLID) together with aggregate
metrics used downstream by the reconstruction and predictor modules.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import ezdxf
from ezdxf.document import Drawing
from ezdxf.layouts import Modelspace


@dataclass
class DXFGeometry:
    """Aggregate 2D geometry extracted from a DXF file."""

    # Raw entity lists (serialisable dicts)
    lines: list[dict[str, Any]] = field(default_factory=list)
    arcs: list[dict[str, Any]] = field(default_factory=list)
    circles: list[dict[str, Any]] = field(default_factory=list)
    polylines: list[dict[str, Any]] = field(default_factory=list)
    solids: list[dict[str, Any]] = field(default_factory=list)

    # Bounding box (mm)
    min_x: float = 0.0
    min_y: float = 0.0
    max_x: float = 0.0
    max_y: float = 0.0

    # Derived metrics
    total_length: float = 0.0
    cross_section_area: float = 0.0
    perimeter: float = 0.0

    @property
    def width(self) -> float:
        return self.max_x - self.min_x

    @property
    def height(self) -> float:
        return self.max_y - self.min_y

    @property
    def aspect_ratio(self) -> float:
        return self.width / self.height if self.height else 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "entity_counts": {
                "lines": len(self.lines),
                "arcs": len(self.arcs),
                "circles": len(self.circles),
                "polylines": len(self.polylines),
                "solids": len(self.solids),
            },
            "bounding_box_mm": {
                "min_x": self.min_x,
                "min_y": self.min_y,
                "max_x": self.max_x,
                "max_y": self.max_y,
                "width": self.width,
                "height": self.height,
            },
            "metrics": {
                "total_length_mm": self.total_length,
                "cross_section_area_mm2": self.cross_section_area,
                "perimeter_mm": self.perimeter,
                "aspect_ratio": self.aspect_ratio,
            },
        }


def parse_dxf(filepath: str | Path) -> DXFGeometry:
    """
    Parse a DXF file and return a DXFGeometry with all extracted data.

    Parameters
    ----------
    filepath : str | Path
        Path to the .dxf file (2D die drawing).

    Returns
    -------
    DXFGeometry

    Raises
    ------
    FileNotFoundError
        If the file does not exist.
    ezdxf.DXFError
        If the file cannot be parsed as a valid DXF.
    """
    filepath = Path(filepath)
    if not filepath.exists():
        raise FileNotFoundError(f"DXF file not found: {filepath}")

    doc: Drawing = ezdxf.readfile(str(filepath))
    msp: Modelspace = doc.modelspace()

    geom = DXFGeometry()
    all_points: list[tuple[float, float]] = []

    def _register_point(x: float, y: float) -> None:
        all_points.append((x, y))

    for entity in msp:
        dxftype = entity.dxftype()

        if dxftype == "LINE":
            s = entity.dxf.start
            e = entity.dxf.end
            length = math.hypot(e.x - s.x, e.y - s.y)
            geom.lines.append({"start": (s.x, s.y), "end": (e.x, e.y), "length": length})
            geom.total_length += length
            _register_point(s.x, s.y)
            _register_point(e.x, e.y)

        elif dxftype == "ARC":
            cx, cy = entity.dxf.center.x, entity.dxf.center.y
            r = entity.dxf.radius
            start_angle = math.radians(entity.dxf.start_angle)
            end_angle = math.radians(entity.dxf.end_angle)
            span = (end_angle - start_angle) % (2 * math.pi)
            arc_length = r * span
            geom.arcs.append({
                "center": (cx, cy), "radius": r,
                "start_angle_deg": entity.dxf.start_angle,
                "end_angle_deg": entity.dxf.end_angle,
                "arc_length": arc_length,
            })
            geom.total_length += arc_length
            _register_point(cx - r, cy - r)
            _register_point(cx + r, cy + r)

        elif dxftype == "CIRCLE":
            cx, cy = entity.dxf.center.x, entity.dxf.center.y
            r = entity.dxf.radius
            circumference = 2 * math.pi * r
            area = math.pi * r * r
            geom.circles.append({"center": (cx, cy), "radius": r, "area_mm2": area})
            geom.total_length += circumference
            geom.cross_section_area += area
            _register_point(cx - r, cy - r)
            _register_point(cx + r, cy + r)

        elif dxftype in ("LWPOLYLINE", "POLYLINE"):
            try:
                pts = list(entity.get_points(format="xy"))
            except Exception:
                pts = []
            if len(pts) >= 2:
                poly_length = 0.0
                for i in range(len(pts) - 1):
                    dx = pts[i + 1][0] - pts[i][0]
                    dy = pts[i + 1][1] - pts[i][1]
                    poly_length += math.hypot(dx, dy)
                try:
                    if entity.dxf.flags & 1:
                        dx = pts[0][0] - pts[-1][0]
                        dy = pts[0][1] - pts[-1][1]
                        poly_length += math.hypot(dx, dy)
                        n = len(pts)
                        area = abs(
                            sum(pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1]
                                for i in range(n)) / 2
                        )
                        geom.cross_section_area += area
                except Exception:
                    pass
                geom.polylines.append({"points": pts, "length": poly_length, "is_closed": True})
                geom.total_length += poly_length
                for p in pts:
                    _register_point(p[0], p[1])

        elif dxftype == "SOLID":
            pts_3d = [entity.dxf.vtx0, entity.dxf.vtx1, entity.dxf.vtx2]
            try:
                pts_3d.append(entity.dxf.vtx3)
            except Exception:
                pass
            pts_2d = [(p.x, p.y) for p in pts_3d]
            n = len(pts_2d)
            area = abs(
                sum(pts_2d[i][0] * pts_2d[(i + 1) % n][1] - pts_2d[(i + 1) % n][0] * pts_2d[i][1]
                    for i in range(n)) / 2
            )
            geom.solids.append({"vertices": pts_2d, "area_mm2": area})
            geom.cross_section_area += area
            for p in pts_2d:
                _register_point(p[0], p[1])

    if all_points:
        xs = [p[0] for p in all_points]
        ys = [p[1] for p in all_points]
        geom.min_x, geom.max_x = min(xs), max(xs)
        geom.min_y, geom.max_y = min(ys), max(ys)

    if geom.cross_section_area == 0.0 and geom.width > 0 and geom.height > 0:
        if geom.circles:
            geom.cross_section_area = math.pi * (geom.width / 2) * (geom.height / 2)
        else:
            geom.cross_section_area = geom.width * geom.height * 0.75

    geom.perimeter = geom.total_length

    return geom
