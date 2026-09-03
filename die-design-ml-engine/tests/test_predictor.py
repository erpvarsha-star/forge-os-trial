"""
test_predictor.py — Tests for locked constants and weight formula.
"""

from __future__ import annotations

import numpy as np
import pytest

from src.predictor import (
    HEAT_LOSS_FRACTION,
    STEEL_DENSITY,
    VARSHA_MASTER_MULTIPLIER,
    WeightPredictor,
    build_dummy_training_data,
)


class TestLockedConstants:
    def test_steel_density_exact(self):
        assert STEEL_DENSITY == pytest.approx(0.785e-6, rel=1e-9)

    def test_heat_loss_exact(self):
        assert HEAT_LOSS_FRACTION == pytest.approx(0.04, rel=1e-9)

    def test_varsha_multiplier_exact(self):
        assert VARSHA_MASTER_MULTIPLIER == pytest.approx(137776, rel=1e-9)


class TestWeightFormula:
    def test_formula_unit_volume(self):
        p = WeightPredictor()
        w = p.predict(1.0, 0.0, 1.0).forging_weight_kg
        assert w == pytest.approx(STEEL_DENSITY * VARSHA_MASTER_MULTIPLIER / 1e6, rel=1e-9)

    def test_formula_typical_forging(self):
        volume = 1_000_000.0
        expected = volume * STEEL_DENSITY * VARSHA_MASTER_MULTIPLIER / 1e6
        result = WeightPredictor().predict(volume, 50_000.0, 1.5)
        assert result.forging_weight_kg == pytest.approx(expected, rel=1e-6)

    def test_flash_loss_is_four_percent(self):
        result = WeightPredictor().predict(1_000_000.0, 50_000.0, 1.5)
        assert result.flash_loss_kg == pytest.approx(result.forging_weight_kg * 0.04, rel=1e-9)

    def test_total_billet_weight(self):
        result = WeightPredictor().predict(2_000_000.0, 80_000.0, 2.0)
        assert result.total_billet_weight_kg == pytest.approx(
            result.forging_weight_kg + result.flash_loss_kg, rel=1e-9
        )

    def test_zero_volume(self):
        result = WeightPredictor().predict(0.0, 0.0, 1.0)
        assert result.forging_weight_kg == pytest.approx(0.0)

    def test_linear_scaling(self):
        p = WeightPredictor()
        r1 = p.predict(1_000_000.0, 50_000.0, 1.0)
        r2 = p.predict(2_000_000.0, 50_000.0, 1.0)
        assert r2.forging_weight_kg == pytest.approx(2 * r1.forging_weight_kg, rel=1e-6)


class TestModelTraining:
    def test_train_does_not_raise(self):
        X, y = build_dummy_training_data(n_samples=20)
        p = WeightPredictor()
        p.train(X, y)
        assert p._trained

    def test_trained_model_predicts_positive(self):
        X, y = build_dummy_training_data(n_samples=50)
        p = WeightPredictor()
        p.train(X, y)
        result = p.predict(1_500_000.0, 60_000.0, 1.5)
        assert result.forging_weight_kg > 0
        assert result.used_ml_model is True

    def test_insufficient_data_raises(self):
        X, y = build_dummy_training_data(n_samples=3)
        with pytest.raises(ValueError, match="at least 5"):
            WeightPredictor().train(X, y)

    def test_save_and_load(self, tmp_path):
        X, y = build_dummy_training_data(n_samples=30)
        p1 = WeightPredictor()
        p1.train(X, y)
        p1.save(tmp_path / "model.pkl")
        p2 = WeightPredictor()
        assert p2.load(tmp_path / "model.pkl") is True
        r1 = p1.predict(1_000_000.0, 50_000.0, 1.5)
        r2 = p2.predict(1_000_000.0, 50_000.0, 1.5)
        assert r1.forging_weight_kg == pytest.approx(r2.forging_weight_kg, rel=1e-6)

    def test_untrained_falls_back_to_formula(self):
        volume = 2_500_000.0
        result = WeightPredictor().predict(volume, 90_000.0, 2.0)
        expected = volume * STEEL_DENSITY * VARSHA_MASTER_MULTIPLIER / 1e6
        assert result.forging_weight_kg == pytest.approx(expected, rel=1e-6)
        assert result.used_ml_model is False
