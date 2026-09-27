# Frontend (Next.js)

This frontend uploads a PATH/TAPP CSV to the FastAPI backend and renders:

- Summary cards (rides, spend, average fare, date range)
- Rides per month chart
- Spend per month chart
- Day-of-week usage chart
- Top routes table (when route columns are available)
- Fare plan recommendation card/table

## Run locally

```bash
cd frontend
npm install
npm run dev
```

By default, uploads are sent to `http://localhost:8000/api/upload`.
Set `NEXT_PUBLIC_BACKEND_URL` if your backend runs elsewhere.
