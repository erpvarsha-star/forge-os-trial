"""
pipeline.py — Orchestrates DXF → JSON prediction.

  1. Parse DXF
  2. Reconstruct 3D geometry
  3. Predict weight (formula + optional XGBoost)
  4. Identify parting line
  5. Size billet
  6. Return JSON
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .billet_sizing import size_billet
from .dxf_parser import parse_dxf
from .parting_line import find_parting_line
from .predictor import WeightPredictor
from .reconstruction import reconstruct_3d

_predictor: Optional[WeightPredictor] = None


def _get_predictor(model_path: Optional[str] = None) -> WeightPredictor:
    global _predictor
    if _predictor is None:
        _predictor = WeightPredictor()
        _predictor.load(model_path) if model_path else _predictor.load()
    return _predictor


def run_pipeline(
    dxf_path: str | Path,
    model_path: Optional[str] = None,
    output_path: Optional[str | Path] = None,
) -> dict:
    dxf_path = Path(dxf_path)
    geom = parse_dxf(dxf_path)
    recon = reconstruct_3d(geom)
    predictor = _get_predictor(model_path)
    prediction = predictor.predict(
        volume_mm3=recon.volume_mm3,
        surface_area_mm2=recon.surface_area_mm2,
        bbox_ratio=geom.aspect_ratio,
    )
    parting = find_parting_line(geom, recon)
    billet = size_billet(prediction.total_billet_weight_kg)

    result = {
        "input_file": str(dxf_path),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "geometry": {
            "volume_mm3": round(recon.volume_mm3, 2),
            "surface_area_mm2": round(recon.surface_area_mm2, 2),
            "bounding_box": {
                "x": round(recon.bounding_box["x"], 2),
                "y": round(recon.bounding_box["y"], 2),
                "z": round(recon.bounding_box["z"], 2),
            },
        },
        "prediction": prediction.to_dict(),
        "parting_line": {
            "plane": parting.plane,
            "z_offset_mm": round(parting.z_offset_mm, 3),
        },
        "billet": {
            "diameter_mm": round(billet.diameter_mm, 1),
            "length_mm": round(billet.length_mm, 1),
            "standard_size": billet.standard_size,
        },
        "model_version": prediction.model_version,
        "confidence": round(prediction.confidence, 3),
        "_diagnostics": {
            "reconstruction_method": recon.method,
            "parting_line_method": parting.method,
            "billet_ld_ratio": round(billet.ld_ratio, 2),
            "dxf_entity_counts": geom.to_dict()["entity_counts"],
        },
    }

    if output_path:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w") as f:
            json.dump(result, f, indent=2)

    return result


def reset_predictor() -> None:
    global _predictor
    _predictor = None
