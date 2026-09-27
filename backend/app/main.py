from __future__ import annotations

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.analysis import analyze_rides
from app.parser import ParserError, parse_rides_csv
from app.schemas import AnalysisResponse

app = FastAPI(title="TAPP PATH Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/upload", response_model=AnalysisResponse)
async def upload_csv(file: UploadFile = File(...)) -> dict:
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a CSV file.")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        parsed = parse_rides_csv(contents)
    except ParserError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    results = analyze_rides(parsed.dataframe)
    results["detected_columns"] = parsed.detected_columns
    return results
