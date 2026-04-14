# HF-ICU Mortality Research Web Calculator

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

This repository contains a Render-ready Flask application for the Journal of Cardiac Failure submission package.

## Runtime

- `app.py`: Flask backend.
- `runtime/catboost_model.cbm`: final CatBoost model trained from the manuscript development-training split.
- `clinical_web_model_card.json`: model, feature, cohort, and benchmark metadata.
- `clinical_risk_comparison.html`: browser interface.
- `requirements.txt`, `Procfile`, and `render.yaml`: Render deployment entrypoints.

## Render

Use a Python Web Service on Render.

- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn -w 1 --threads 4 --timeout 120 -b 0.0.0.0:$PORT app:app`

After deployment, verify:

- `/healthz`
- `/api/config`
- `/api/predict`
