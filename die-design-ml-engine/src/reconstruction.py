"""
reconstruction.py — 2D → 3D reconstruction of a forging die profile.

Approach
--------
1. (Primary) pythonocc-core: revolve or extrude the 2D profile.
2. (Fallback) Geometric approximation from bounding box + cross-section area.

TODO (Phase 2):
  - Wire pythonocc-core revolve() for axisymmetric parts
  - Wire pythonocc-core extrude() for prismatic parts
  - Auto-detect revolution vs prismatic
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Literal

from .dxf_parser import DXFGeometry


@dataclass
class ReconstructionResult:
    """3D geometry derived from the 2D DXF profile."""

    volume_mm3: float
    surface_area_mm2: float
    bounding_box: dict[str, float]
    method: Literal["pythonocc", "geometric_approximation"]
    notes: str = ""

    def to_dict(self) -> dict:
        return {
            "volume_mm3": self.volume_mm3,
            "surface_area_mm2": self.surface_area_mm2,
            "bounding_box": self.bounding_box,
            "method": self.method,
            "notes": self.notes,
        }


def reconstruct_3d(geom: DXFGeometry) -> ReconstructionResult:
    """Convert 2D DXF geometry to 3D volume + surface area."""
    try:
        return _reconstruct_with_occ(geom)
    except ImportError:
        pass
    except Exception as exc:
        import warnings
        warnings.warn(f"pythonocc-core reconstruction failed ({exc}); using geometric approximation.")

    return _reconstruct_geometric(geom)


def _reconstruct_with_occ(geom: DXFGeometry) -> ReconstructionResult:
    """
    TODO (Phase 2): Use pythonocc-core revolve/extrude.
    Import below will raise ImportError if OCC not installed — triggers fallback.
    """
    from OCC.Core.gp import gp_Pnt  # noqa: F401
    raise NotImplementedError("pythonocc-core revolve/extrude not yet implemented. Phase 2.")


def _reconstruct_geometric(geom: DXFGeometry) -> ReconstructionResult:
    """
    Geometric approximation from 2D bounding box + cross-section area.
    """
    w = geom.width
    h = geom.height
    area = geom.cross_section_area

    if area <= 0 or w <= 0 or h <= 0:
        return ReconstructionResult(
            volume_mm3=0.0, surface_area_mm2=0.0,
            bounding_box={"x": w, "y": h, "z": 0.0},
            method="geometric_approximation",
            notes="Zero-area geometry — check DXF entities.",
        )

    has_circles = len(geom.circles) > 0

    if has_circles:
        r = w / 2.0
        depth = h
        volume = math.pi * r * r * depth
        surface = 2 * math.pi * r * r + 2 * math.pi * r * depth
    else:
        depth = min(w, h) * 0.6
        volume = area * depth
        surface = 2 * area + geom.perimeter * depth

    return ReconstructionResult(
        volume_mm3=volume,
        surface_area_mm2=surface,
        bounding_box={"x": w, "y": h, "z": depth},
        method="geometric_approximation",
        notes="Replace with pythonocc-core revolve/extrude in Phase 2.",
    )
