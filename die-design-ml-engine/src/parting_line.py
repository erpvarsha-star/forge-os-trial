"""
parting_line.py — Parting line (split plane) identification.

The parting line is the plane of maximum cross-section area where
upper and lower die halves meet and flash forms.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .dxf_parser import DXFGeometry
from .reconstruction import ReconstructionResult


@dataclass
class PartingLineResult:
    plane: Literal["XY", "XZ", "YZ"]
    z_offset_mm: float
    max_cross_section_mm2: float
    method: str
    notes: str = ""

    def to_dict(self) -> dict:
        return {
            "plane": self.plane,
            "z_offset_mm": round(self.z_offset_mm, 3),
            "max_cross_section_mm2": round(self.max_cross_section_mm2, 2),
            "method": self.method,
            "notes": self.notes,
        }


def find_parting_line(geom: DXFGeometry, recon: ReconstructionResult) -> PartingLineResult:
    if recon.method == "pythonocc":
        return _parting_line_occ(geom, recon)
    return _parting_line_geometric(geom, recon)


def _parting_line_occ(geom: DXFGeometry, recon: ReconstructionResult) -> PartingLineResult:
    """TODO Phase 2: OCC section slicing. Falling through to geometric for now."""
    return _parting_line_geometric(geom, recon)


def _parting_line_geometric(geom: DXFGeometry, recon: ReconstructionResult) -> PartingLineResult:
    bbox = recon.bounding_box
    w, h, d = bbox["x"], bbox["y"], bbox["z"]

    area_xy = w * h
    area_xz = w * d
    area_yz = h * d

    has_circles = len(geom.circles) > 0

    if has_circles or area_xy >= max(area_xz, area_yz):
        plane: Literal["XY", "XZ", "YZ"] = "XY"
        z_offset = d / 2.0
        max_area = area_xy
        reason = "equatorial XY plane"
    elif area_xz >= area_yz:
        plane = "XZ"
        z_offset = h / 2.0
        max_area = area_xz
        reason = "XZ mid-plane"
    else:
        plane = "YZ"
        z_offset = w / 2.0
        max_area = area_yz
        reason = "YZ mid-plane"

    return PartingLineResult(
        plane=plane, z_offset_mm=z_offset, max_cross_section_mm2=max_area,
        method="geometric_midplane",
        notes=f"{reason}. Replace with OCC slicing in Phase 2.",
    )
