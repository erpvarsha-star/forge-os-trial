"""
test_dxf_parser.py — Tests for the DXF ingestion module.
Creates synthetic DXF files in memory using ezdxf.
"""

from __future__ import annotations

import math
import tempfile
from pathlib import Path

import ezdxf
import pytest

from src.dxf_parser import DXFGeometry, parse_dxf


def _make_dxf_with_circle(radius: float = 50.0) -> Path:
    doc = ezdxf.new()
    msp = doc.modelspace()
    msp.add_circle(center=(0, 0, 0), radius=radius)
    tmp = tempfile.NamedTemporaryFile(suffix=".dxf", delete=False)
    doc.saveas(tmp.name)
    return Path(tmp.name)


def _make_dxf_with_lines(points: list[tuple[float, float]]) -> Path:
    doc = ezdxf.new()
    msp = doc.modelspace()
    for i in range(len(points) - 1):
        msp.add_line((*points[i], 0), (*points[i + 1], 0))
    tmp = tempfile.NamedTemporaryFile(suffix=".dxf", delete=False)
    doc.saveas(tmp.name)
    return Path(tmp.name)


def _make_dxf_with_polyline(points: list[tuple[float, float]], closed: bool = True) -> Path:
    doc = ezdxf.new()
    msp = doc.modelspace()
    flags = ezdxf.const.LWPOLYLINE_CLOSED if closed else 0
    msp.add_lwpolyline(points, dxfattribs={"flags": flags})
    tmp = tempfile.NamedTemporaryFile(suffix=".dxf", delete=False)
    doc.saveas(tmp.name)
    return Path(tmp.name)


class TestReturnType:
    def test_returns_dxf_geometry(self):
        assert isinstance(parse_dxf(_make_dxf_with_circle()), DXFGeometry)

    def test_has_required_keys(self):
        d = parse_dxf(_make_dxf_with_circle()).to_dict()
        assert "entity_counts" in d
        assert "bounding_box_mm" in d
        assert "metrics" in d

    def test_metrics_has_expected_fields(self):
        metrics = parse_dxf(_make_dxf_with_circle()).to_dict()["metrics"]
        for key in ("total_length_mm", "cross_section_area_mm2", "perimeter_mm", "aspect_ratio"):
            assert key in metrics


class TestCircle:
    def test_circle_area(self):
        r = 50.0
        result = parse_dxf(_make_dxf_with_circle(r))
        assert abs(result.cross_section_area - math.pi * r * r) < 1.0

    def test_circle_bounding_box(self):
        r = 50.0
        result = parse_dxf(_make_dxf_with_circle(r))
        assert abs(result.width - 2 * r) < 0.1
        assert abs(result.height - 2 * r) < 0.1

    def test_circle_total_length(self):
        r = 50.0
        result = parse_dxf(_make_dxf_with_circle(r))
        assert abs(result.total_length - 2 * math.pi * r) < 1.0


class TestLines:
    def test_line_entity_count(self):
        pts = [(0, 0), (100, 0), (100, 80), (0, 80), (0, 0)]
        result = parse_dxf(_make_dxf_with_lines(pts))
        assert result.to_dict()["entity_counts"]["lines"] == len(pts) - 1

    def test_bounding_box_from_lines(self):
        pts = [(0, 0), (200, 0), (200, 150)]
        result = parse_dxf(_make_dxf_with_lines(pts))
        assert abs(result.width - 200) < 0.1
        assert abs(result.height - 150) < 0.1

    def test_total_length_is_positive(self):
        pts = [(0, 0), (100, 0), (100, 100)]
        assert parse_dxf(_make_dxf_with_lines(pts)).total_length > 0


class TestPolyline:
    def test_closed_polyline_cross_section(self):
        pts = [(0, 0), (100, 0), (100, 80), (0, 80)]
        result = parse_dxf(_make_dxf_with_polyline(pts, closed=True))
        assert result.cross_section_area > 0


class TestErrorHandling:
    def test_missing_file_raises(self):
        with pytest.raises(FileNotFoundError):
            parse_dxf("/nonexistent/path/file.dxf")

    def test_empty_dxf(self):
        doc = ezdxf.new()
        tmp = tempfile.NamedTemporaryFile(suffix=".dxf", delete=False)
        doc.saveas(tmp.name)
        result = parse_dxf(tmp.name)
        assert isinstance(result, DXFGeometry)
        assert result.cross_section_area >= 0
