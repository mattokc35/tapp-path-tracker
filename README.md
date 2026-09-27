# tapp-path-tracker

A personal web app for analyzing an NJ Transit PATH (TAPP) ride CSV export, visualizing usage/spend trends, and recommending the most cost-effective fare plan.

## Stack

- **Frontend:** Next.js + React + TypeScript + Recharts
- **Backend:** FastAPI + pandas + pydantic

## Project Structure

- `/frontend` – upload UI and dashboard visualizations
- `/backend` – CSV parsing, ride analysis, and recommendation API

## Local Development

### 1) Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API will be available at `http://localhost:8000`.

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

App will run at `http://localhost:3000`.

The frontend posts uploads to `http://localhost:8000/api/upload` by default.

## Sample Data

A demo CSV is included at:

- `/backend/sample_data/sample_rides.csv`

Use it to test the end-to-end flow without real rider data.

## Expected CSV Format

The backend now expects the real TAPP `trip_history.csv` export schema:

```csv
Reference,Transit Account #,Trip time,Mode,Location,Product Type,Fare Amount ($)
104390291,"=""100060443445""",2026-09-13 10:26 AM,Rail,Grove Street,Stored Value,$3.25
103913748,"=""100060443445""",2026-09-10 4:52 PM,Rail,Grove Street,40-Trip,-
```

Notes:

- `Transit Account #` is exported as an Excel-style forced-text formula such as `="100060443445"` and is cleaned automatically to `100060443445`.
- `Trip time` is parsed from the single timestamp column using the export format `YYYY-MM-DD h:mm AM/PM`.
- `Fare Amount ($)` values like `$3.25` are parsed as spend, while `-` is treated as a pass-based ride with no incremental charge.
- The export contains a single `Location` field per tap, not separate origin/destination columns.

## Current Scope (v1)

- CSV upload and validation for the TAPP trip-history export
- Summary metrics (rides, stored-value spend, stored-value average fare, pass/stored-value ride counts, date range)
- Monthly rides/spend charts
- Day-of-week usage chart
- Location usage and product-type breakdowns
- Trip history table with the exported columns
- Overall and per-month fare-plan recommendation logic, including optional pack-price overrides

## Planned Future Features (not in this PR)

- PDF import/parsing
- "Hot routes" map/geographic visualization
