# tapp-path-tracker

A personal web app for analyzing a 12-month NJ Transit PATH (TAPP) ride CSV export, visualizing usage/spend trends, and recommending the most cost-effective fare plan.

## Stack

- **Frontend:** Next.js + React + TypeScript + Recharts
- **Backend:** FastAPI + pandas + pydantic

## Project Structure

- `/frontend` – upload UI and dashboard visualizations
- `/backend` – CSV parsing, ride analysis, and recommendation API

## Local Development

### 1) Backend

```bash
cd /home/runner/work/tapp-path-tracker/tapp-path-tracker/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API will be available at `http://localhost:8000`.

### 2) Frontend

```bash
cd /home/runner/work/tapp-path-tracker/tapp-path-tracker/frontend
npm install
npm run dev
```

App will run at `http://localhost:3000`.

The frontend posts uploads to `http://localhost:8000/api/upload` by default.

## Sample Data

A demo CSV is included at:

- `/backend/sample_data/sample_rides.csv`

Use it to test the end-to-end flow without real rider data.

## Current Scope (v1)

- CSV upload and defensive column detection
- Summary metrics (rides, spend, average fare, date range)
- Monthly rides/spend charts
- Day-of-week usage chart
- Top routes table (if origin/destination columns exist)
- Overall and per-month fare-plan recommendation logic

## Planned Future Features (not in this PR)

- PDF import/parsing
- "Hot routes" map/geographic visualization
