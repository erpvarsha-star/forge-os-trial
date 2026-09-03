# Die Design ML Engine

**Varsha Forgings Pvt Ltd — Internal Tool**  
ML pipeline that predicts forging weight, flash loss, parting line and billet size from 2D die design drawings (DXF files).

---

## What this is

A Python-based machine learning pipeline that takes a 2D die drawing (`.dxf`) as input and outputs a JSON prediction covering:

- **Forging weight** (kg) — predicted from reconstructed 3D volume
- **Flash loss** (kg + %) — 4% of forging weight, per Varsha standard
- **Total billet weight** (kg) — forging weight + flash loss
- **Parting line** — the plane (XY/XZ/YZ) and offset where the die halves split
- **Billet size** — standard diameter and length from Varsha's round-bar stock list

The pipeline runs in two modes:
1. **Formula mode** (default) — uses the locked Varsha constants to compute weight deterministically from volume.
2. **ML mode** — uses a trained XGBoost model to refine the formula estimate, activated once real DXF training data is available.

---

## Locked constants

These values are non-negotiable. They live in `src/predictor.py` as named constants.

| Constant | Value | Meaning |
|---|---|---|
| `STEEL_DENSITY` | `0.785e-6` kg/mm³ | Forging steel density (7850 kg/m³ in mm units) |
| `HEAT_LOSS_FRACTION` | `0.04` | Flash/heat loss = 4% of forging weight |
| `VARSHA_MASTER_MULTIPLIER` | `137776` | Calibration factor derived from Varsha's actual production forgings — absorbs unit conversion and material variability |

**Never change these without Yash's sign-off.**

---

## JSON output schema

```json
{
  "input_file": "path/to/drawing.dxf",
  "timestamp": "2026-09-03T10:00:00+00:00",
  "geometry": {
    "volume_mm3": 1250000.0,
    "surface_area_mm2": 65000.0,
    "bounding_box": {"x": 150.0, "y": 120.0, "z": 90.0}
  },
  "prediction": {
    "forging_weight_kg": 13.52,
    "flash_loss_kg": 0.54,
    "flash_loss_pct": 4.0,
    "total_billet_weight_kg": 14.06
  },
  "parting_line": {
    "plane": "XY",
    "z_offset_mm": 45.0
  },
  "billet": {
    "diameter_mm": 90.0,
    "length_mm": 221.0,
    "standard_size": "Ø90 × 221 mm"
  },
  "model_version": "formula-only-v0.1",
  "confidence": 0.5
}
```

---

## Setup

### Prerequisites

- Python 3.10+
- pip

### Install

```bash
git clone https://github.com/erpvarsha-star/Die_Design_ML_Engine.git
cd Die_Design_ML_Engine
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

> `pythonocc-core` is optional (Phase 2). If it fails to install on your system, the pipeline falls back to geometric approximation automatically.

---

## Run the API

```bash
uvicorn api.main:app --reload --port 8000
```

Then in another terminal:

```bash
curl -X POST http://localhost:8000/predict \
     -F "file=@data/my_die_drawing.dxf"
```

Or visit `http://localhost:8000/docs` for the Swagger UI.

Health check:
```bash
curl http://localhost:8000/health
# {"status": "ok", "version": "0.1.0"}
```

---

## Run the pipeline from Python

```python
from src.pipeline import run_pipeline

result = run_pipeline("data/bracket_v3.dxf")
print(result["prediction"]["forging_weight_kg"])   # e.g. 8.42
print(result["billet"]["standard_size"])            # e.g. "Ø80 × 188 mm"
```

---

## Add training DXF files (WAITING YASH)

1. Copy real DXF files from the die shop into `data/` — they are `.gitignore`d.
2. Pair each DXF with the actual forging weight (from production records or the payroll system).
3. Run the training script (Phase 2).

---

## Run tests

```bash
pytest tests/ -v
```

---

## Phase roadmap

| Phase | Description | Status |
|---|---|---|
| 0 | Scaffold + formula mode + FastAPI | ✅ Done (03 Sep 2026) |
| 1 | Collect real DXF files from die shop | ⏳ WAITING YASH |
| 2 | pythonocc-core revolve/extrude for exact volumes | ⏳ After Phase 1 |
| 3 | Train XGBoost on real data; validate against production weights | ⏳ After Phase 2 |
| 4 | Integrate with Forge OS | ⏳ After Phase 3 |

---

*Built for Varsha Forgings Pvt Ltd, Aurangabad.*  
*File: `CODE_DieDesignML_Init_03SEP2026`*
