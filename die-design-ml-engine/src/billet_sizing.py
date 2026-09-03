"""
billet_sizing.py — Standard billet diameter/length from forging volume.

Standard round billet diameters stocked at VFPL (mm):
  25, 30, 32, 36, 40, 45, 50, 55, 60, 63, 70, 75, 80, 90, 100,
  110, 120, 125, 130, 140, 150, 160, 170, 180, 190, 200

Target L/D ratio: 2.0–2.5 (standard forging rule for workpiece stability).
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from .predictor import STEEL_DENSITY

STANDARD_DIAMETERS_MM: list[float] = [
    25, 30, 32, 36, 40, 45, 50, 55, 60, 63, 70, 75, 80, 90, 100,
    110, 120, 125, 130, 140, 150, 160, 170, 180, 190, 200,
]

LD_RATIO_TARGET = 2.2
LD_RATIO_MAX    = 3.0


@dataclass
class BilletResult:
    diameter_mm: float
    length_mm: float
    volume_mm3: float
    standard_size: str
    ld_ratio: float
    notes: str = ""

    def to_dict(self) -> dict:
        return {
            "diameter_mm": round(self.diameter_mm, 1),
            "length_mm": round(self.length_mm, 1),
            "volume_mm3": round(self.volume_mm3, 1),
            "standard_size": self.standard_size,
            "ld_ratio": round(self.ld_ratio, 2),
            "notes": self.notes,
        }


def size_billet(total_billet_weight_kg: float) -> BilletResult:
    if total_billet_weight_kg <= 0:
        return BilletResult(
            diameter_mm=0, length_mm=0, volume_mm3=0,
            standard_size="N/A", ld_ratio=0,
            notes="Zero or negative billet weight.",
        )

    required_volume_mm3 = total_billet_weight_kg / STEEL_DENSITY

    best: BilletResult | None = None

    for d in STANDARD_DIAMETERS_MM:
        r = d / 2.0
        length = required_volume_mm3 / (math.pi * r * r)
        ld = length / d

        candidate = BilletResult(
            diameter_mm=d, length_mm=length,
            volume_mm3=math.pi * r * r * length,
            standard_size=f"Ø{d:.0f} × {length:.0f} mm",
            ld_ratio=ld,
        )

        if best is None:
            best = candidate
            continue

        if ld <= LD_RATIO_MAX:
            if best.ld_ratio > LD_RATIO_MAX or abs(ld - LD_RATIO_TARGET) < abs(best.ld_ratio - LD_RATIO_TARGET):
                best = candidate

    if best is None:
        d = STANDARD_DIAMETERS_MM[-1]
        r = d / 2.0
        length = required_volume_mm3 / (math.pi * r * r)
        best = BilletResult(
            diameter_mm=d, length_mm=length, volume_mm3=required_volume_mm3,
            standard_size=f"Ø{d:.0f} × {length:.0f} mm (non-standard)",
            ld_ratio=length / d,
            notes="No standard size achieves L/D ≤ 3.",
        )

    if best.ld_ratio > LD_RATIO_MAX:
        best.notes = f"L/D = {best.ld_ratio:.2f} exceeds max {LD_RATIO_MAX}. Consider larger diameter."

    return best
