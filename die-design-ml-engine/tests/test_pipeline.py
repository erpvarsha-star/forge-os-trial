"""
test_pipeline.py — End-to-end pipeline tests using synthetic DXF files.
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path
from datetime import datetime

import ezdxf
import pytest

from src.pipeline import reset_predictor, run_pipeline
from src.billet_sizing import STANDARD_DIAMETERS_MM


def _synthetic_circle_dxf(radius: float = 60.0) -> Path:
    doc = ezdxf.new()
    msp = doc.modelspace()
    msp.add_circle(center=(0, 0, 0), radius=radius)
    msp.add_line((-radius - 10, 0, 0), (radius + 10, 0, 0))
    msp.add_line((0, -radius - 10, 0), (0, radius + 10, 0))
    tmp = tempfile.NamedTemporaryFile(suffix=".dxf", delete=False)
    doc.saveas(tmp.name)
    return Path(tmp.name)


def _synthetic_prismatic_dxf(width: float = 120.0, height: float = 80.0) -> Path:
    doc = ezdxf.new()
    msp = doc.modelspace()
    pts = [(0, 0), (width, 0), (width, height), (0, height)]
    msp.add_lwpolyline(pts, dxfattribs={"flags": ezdxf.const.LWPOLYLINE_CLOSED})
    tmp = tempfile.NamedTemporaryFile(suffix=".dxf", delete=False)
    doc.saveas(tmp.name)
    return Path(tmp.name)


REQUIRED_TOP = {"input_file", "timestamp", "geometry", "prediction", "parting_line", "billet", "model_version", "confidence"}
REQUIRED_GEOM = {"volume_mm3", "surface_area_mm2", "bounding_box"}
REQUIRED_PRED = {"forging_weight_kg", "flash_loss_kg", "flash_loss_pct", "total_billet_weight_kg", "model_version", "confidence"}


class TestPipelineSchema:
    def setup_method(self): reset_predictor()

    def test_circle_schema(self):
        r = run_pipeline(_synthetic_circle_dxf())
        assert REQUIRED_TOP <= set(r)
        assert REQUIRED_GEOM <= set(r["geometry"])
        assert REQUIRED_PRED <= set(r["prediction"])
        assert {"plane", "z_offset_mm"} <= set(r["parting_line"])
        assert {"diameter_mm", "length_mm", "standard_size"} <= set(r["billet"])

    def test_prismatic_schema(self):
        r = run_pipeline(_synthetic_prismatic_dxf())
        assert REQUIRED_TOP <= set(r)

    def test_json_serialisable(self):
        r = run_pipeline(_synthetic_circle_dxf())
        assert len(json.dumps(r)) > 0

    def test_timestamp_iso8601(self):
        r = run_pipeline(_synthetic_circle_dxf())
        datetime.fromisoformat(r["timestamp"])  # raises if invalid


class TestPipelineValues:
    def setup_method(self): reset_predictor()

    def test_volume_positive(self):
        assert run_pipeline(_synthetic_circle_dxf(60.0))["geometry"]["volume_mm3"] > 0

    def test_weight_positive(self):
        assert run_pipeline(_synthetic_circle_dxf())["prediction"]["forging_weight_kg"] > 0

    def test_flash_four_percent(self):
        pred = run_pipeline(_synthetic_circle_dxf())["prediction"]
        assert pred["flash_loss_pct"] == pytest.approx(4.0, rel=1e-3)

    def test_total_billet_weight(self):
        pred = run_pipeline(_synthetic_prismatic_dxf())["prediction"]
        assert pred["total_billet_weight_kg"] == pytest.approx(
            pred["forging_weight_kg"] + pred["flash_loss_kg"], rel=1e-6
        )

    def test_parting_plane_valid(self):
        r = run_pipeline(_synthetic_circle_dxf())
        assert r["parting_line"]["plane"] in ("XY", "XZ", "YZ")

    def test_billet_is_standard(self):
        r = run_pipeline(_synthetic_circle_dxf())
        assert r["billet"]["diameter_mm"] in STANDARD_DIAMETERS_MM

    def test_confidence_in_range(self):
        c = run_pipeline(_synthetic_circle_dxf())["confidence"]
        assert 0.0 <= c <= 1.0


class TestPipelineOutput:
    def setup_method(self): reset_predictor()

    def test_writes_json(self, tmp_path):
        out = tmp_path / "result.json"
        r = run_pipeline(_synthetic_circle_dxf(), output_path=out)
        assert out.exists()
        loaded = json.loads(out.read_text())
        assert loaded["prediction"]["forging_weight_kg"] == pytest.approx(
            r["prediction"]["forging_weight_kg"], rel=1e-6
        )

    def test_missing_file_raises(self):
        with pytest.raises(FileNotFoundError):
            run_pipeline("/nonexistent/die.dxf")
