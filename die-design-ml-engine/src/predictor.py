"""
predictor.py — XGBoost forging-weight predictor + locked physical constants.

Locked constants (non-negotiable):
  STEEL_DENSITY            = 0.785e-6  kg/mm³
  HEAT_LOSS_FRACTION       = 0.04      (4% flash loss)
  VARSHA_MASTER_MULTIPLIER = 137776    (calibration — absorbs unit conversion + material factor)

Weight formula:
  raw_weight_kg       = volume_mm3 * STEEL_DENSITY * VARSHA_MASTER_MULTIPLIER / 1e6
  flash_loss_kg       = raw_weight_kg * HEAT_LOSS_FRACTION
  total_billet_weight = raw_weight_kg + flash_loss_kg
"""

from __future__ import annotations

import pickle
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np
from sklearn.preprocessing import StandardScaler

# ============================================================
# LOCKED CONSTANTS — never use these values inline elsewhere
# ============================================================
STEEL_DENSITY: float = 0.785e-6
HEAT_LOSS_FRACTION: float = 0.04
VARSHA_MASTER_MULTIPLIER: float = 137776

FEATURE_NAMES = ["volume_mm3", "surface_area_mm2", "bbox_ratio"]
DEFAULT_MODEL_PATH = Path(__file__).parent.parent / "models" / "xgb_weight_predictor.pkl"


@dataclass
class PredictionResult:
    forging_weight_kg: float
    flash_loss_kg: float
    flash_loss_pct: float
    total_billet_weight_kg: float
    model_version: str
    confidence: float
    used_ml_model: bool

    def to_dict(self) -> dict:
        return {
            "forging_weight_kg": round(self.forging_weight_kg, 4),
            "flash_loss_kg": round(self.flash_loss_kg, 4),
            "flash_loss_pct": round(self.flash_loss_pct * 100, 2),
            "total_billet_weight_kg": round(self.total_billet_weight_kg, 4),
            "model_version": self.model_version,
            "confidence": round(self.confidence, 3),
        }


class WeightPredictor:
    def __init__(self) -> None:
        self._model = None
        self._scaler: Optional[StandardScaler] = None
        self._model_version: str = "formula-only-v0.1"
        self._trained: bool = False

    def predict(self, volume_mm3: float, surface_area_mm2: float, bbox_ratio: float) -> PredictionResult:
        formula_weight = self._formula_weight(volume_mm3)

        if self._trained and self._model is not None:
            ml_weight, confidence = self._ml_predict(volume_mm3, surface_area_mm2, bbox_ratio)
            forging_weight = confidence * ml_weight + (1.0 - confidence) * formula_weight
            used_ml = True
        else:
            forging_weight = formula_weight
            confidence = 0.5
            used_ml = False

        flash_loss = forging_weight * HEAT_LOSS_FRACTION
        total_billet = forging_weight + flash_loss

        return PredictionResult(
            forging_weight_kg=forging_weight,
            flash_loss_kg=flash_loss,
            flash_loss_pct=HEAT_LOSS_FRACTION,
            total_billet_weight_kg=total_billet,
            model_version=self._model_version,
            confidence=confidence,
            used_ml_model=used_ml,
        )

    def train(self, X: np.ndarray, y: np.ndarray) -> None:
        try:
            import xgboost as xgb
        except ImportError as exc:
            raise RuntimeError("xgboost is not installed. Run: pip install xgboost") from exc

        if X.shape[0] < 5:
            raise ValueError(f"Need at least 5 training samples, got {X.shape[0]}.")

        self._scaler = StandardScaler()
        X_scaled = self._scaler.fit_transform(X)

        self._model = xgb.XGBRegressor(
            n_estimators=300, max_depth=4, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8,
            objective="reg:squarederror", random_state=42, n_jobs=-1,
        )
        self._model.fit(X_scaled, y)
        self._trained = True
        self._model_version = "xgb-v0.1"

    def save(self, path: str | Path = DEFAULT_MODEL_PATH) -> None:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump({"model": self._model, "scaler": self._scaler, "version": self._model_version}, f)

    def load(self, path: str | Path = DEFAULT_MODEL_PATH) -> bool:
        path = Path(path)
        if not path.exists():
            return False
        with open(path, "rb") as f:
            payload = pickle.load(f)
        self._model = payload["model"]
        self._scaler = payload.get("scaler")
        self._model_version = payload.get("version", "xgb-unknown")
        self._trained = self._model is not None
        return self._trained

    @staticmethod
    def _formula_weight(volume_mm3: float) -> float:
        return volume_mm3 * STEEL_DENSITY * VARSHA_MASTER_MULTIPLIER / 1e6

    def _ml_predict(self, volume_mm3: float, surface_area_mm2: float, bbox_ratio: float) -> tuple[float, float]:
        X = np.array([[volume_mm3, surface_area_mm2, bbox_ratio]], dtype=np.float64)
        if self._scaler is not None:
            X = self._scaler.transform(X)
        weight = float(self._model.predict(X)[0])
        weight = max(0.0, weight)
        formula = self._formula_weight(volume_mm3)
        if formula > 0:
            ratio = weight / formula
            confidence = max(0.1, min(0.95, 1.0 - abs(ratio - 1.0) * 0.5))
        else:
            confidence = 0.5
        return weight, confidence


def build_dummy_training_data(n_samples: int = 100) -> tuple[np.ndarray, np.ndarray]:
    """Synthetic (features, weights) for smoke-testing. Replace with real DXF data."""
    rng = np.random.default_rng(42)
    volume_mm3 = rng.uniform(500_000, 5_000_000, n_samples)
    surface_area_mm2 = rng.uniform(10_000, 150_000, n_samples)
    bbox_ratio = rng.uniform(0.5, 3.0, n_samples)
    X = np.column_stack([volume_mm3, surface_area_mm2, bbox_ratio])
    y_base = volume_mm3 * STEEL_DENSITY * VARSHA_MASTER_MULTIPLIER / 1e6
    y = y_base * (1.0 + rng.normal(0, 0.05, n_samples))
    y = np.clip(y, 0.1, None)
    return X, y
