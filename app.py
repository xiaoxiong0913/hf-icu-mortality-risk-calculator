from __future__ import annotations

import json
from pathlib import Path

from catboost import CatBoostClassifier
from flask import Flask, jsonify, request, send_from_directory


ROOT = Path(__file__).resolve().parent
CONFIG = json.loads((ROOT / "clinical_web_model_card.json").read_text(encoding="utf-8"))
FEATURES = CONFIG["features"]
DEFAULTS = CONFIG["defaults"]
MODEL = CatBoostClassifier()
MODEL.load_model(str(ROOT / "runtime" / "catboost_model.cbm"))

app = Flask(__name__)


def _coerce_value(feature: dict, payload: dict) -> float:
    key = feature["key"]
    value = payload.get(key, DEFAULTS[key])
    if key == "Sex" and isinstance(value, str):
        value = 1 if value.lower().startswith("m") else 0
    if value in ("", None):
        raise ValueError(f"{feature['label']} is required.")
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{feature['label']} must be numeric.")
    if feature.get("integer_only") and not numeric.is_integer():
        raise ValueError(f"{feature['label']} must use a whole number.")
    precision = int(feature.get("precision", 2))
    if feature.get("integer_only"):
        return float(int(numeric))
    return round(numeric, precision)


@app.get("/")
def index():
    return send_from_directory(ROOT, "clinical_risk_comparison.html")


@app.get("/healthz")
def healthz():
    return jsonify({"status": "ok", "model": CONFIG["model"]["name"]})


@app.get("/api/config")
def config():
    return jsonify(CONFIG)


@app.post("/api/predict")
def predict():
    payload = request.get_json(silent=True) or {}
    try:
        values = [_coerce_value(feature, payload) for feature in FEATURES]
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    probability = float(MODEL.predict_proba([values])[:, 1][0])
    threshold = float(CONFIG["performance"]["internal_validation"]["youden_cutoff"])
    return jsonify(
        {
            "risk": probability,
            "risk_percent": round(probability * 100, 1),
            "threshold": threshold,
            "risk_group": "Higher risk" if probability >= threshold else "Lower risk",
            "model": CONFIG["model"]["name"],
        }
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8765)
