"""
api/main.py — FastAPI prediction endpoint.

POST /predict  — accepts DXF upload, returns JSON prediction.
GET  /health   — returns {status, version}.

Run: uvicorn api.main:app --reload --port 8000
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

sys.path.insert(0, str(Path(__file__).parent.parent))

from src import __version__
from src.pipeline import run_pipeline

app = FastAPI(
    title="Die Design ML Engine",
    description="Predicts forging weight, flash loss, parting line, and billet size from 2D DXF die drawings.",
    version=__version__,
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "version": __version__}


@app.post("/predict")
async def predict(file: UploadFile = File(...)) -> JSONResponse:
    if not (file.filename or "").lower().endswith(".dxf"):
        raise HTTPException(status_code=400, detail=f"Expected .dxf, got: {file.filename!r}")

    with tempfile.NamedTemporaryFile(suffix=".dxf", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = Path(tmp.name)

    try:
        result = run_pipeline(tmp_path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=400 if "DXF" in type(exc).__name__ else 500,
            detail=f"Pipeline error: {exc}",
        ) from exc
    finally:
        tmp_path.unlink(missing_ok=True)

    if result["geometry"]["volume_mm3"] == 0.0:
        result["_warning"] = "Volume is 0. DXF may contain unsupported entities."

    return JSONResponse(content=result)
