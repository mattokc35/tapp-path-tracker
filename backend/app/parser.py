from __future__ import annotations

import io
import re
from dataclasses import dataclass
from typing import Iterable

import pandas as pd


class ParserError(ValueError):
    """Raised when required CSV columns cannot be identified."""


@dataclass
class ParsedCSV:
    dataframe: pd.DataFrame
    detected_columns: dict[str, str]


COLUMN_ALIASES: dict[str, list[str]] = {
    "date": ["date", "transaction date", "ride date", "posted date"],
    "time": ["time", "transaction time", "ride time"],
    "fare": ["amount", "fare", "cost", "fare amount", "transaction amount"],
    "origin": ["origin", "from", "origin station", "start station", "entry station"],
    "destination": [
        "destination",
        "to",
        "destination station",
        "end station",
        "exit station",
    ],
    "ride_type": ["ride type", "fare category", "category", "type"],
}


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", str(text).strip().lower())).strip()


def _detect_column(columns: Iterable[str], aliases: list[str]) -> str | None:
    normalized_map = {col: _normalize(col) for col in columns}

    for alias in aliases:
        normalized_alias = _normalize(alias)
        for original, normalized in normalized_map.items():
            if normalized == normalized_alias:
                return original

    for alias in aliases:
        normalized_alias = _normalize(alias)
        for original, normalized in normalized_map.items():
            if normalized_alias in normalized:
                return original

    return None


def _as_number(value: object) -> float:
    if pd.isna(value):
        return float("nan")
    cleaned = str(value).replace("$", "").replace(",", "").strip()
    try:
        return float(cleaned)
    except ValueError:
        return float("nan")


def parse_rides_csv(contents: bytes) -> ParsedCSV:
    try:
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as exc:  # pragma: no cover - parser-specific error text varies
        raise ParserError(f"Could not parse CSV file: {exc}") from exc

    if df.empty:
        raise ParserError("Uploaded CSV is empty.")

    date_col = _detect_column(df.columns, COLUMN_ALIASES["date"])
    fare_col = _detect_column(df.columns, COLUMN_ALIASES["fare"])

    detected_columns = {
        "date": date_col,
        "fare": fare_col,
        "time": _detect_column(df.columns, COLUMN_ALIASES["time"]),
        "origin": _detect_column(df.columns, COLUMN_ALIASES["origin"]),
        "destination": _detect_column(df.columns, COLUMN_ALIASES["destination"]),
        "ride_type": _detect_column(df.columns, COLUMN_ALIASES["ride_type"]),
    }

    if not date_col or not fare_col:
        detected_list = ", ".join(str(c) for c in df.columns)
        raise ParserError(
            "Could not identify required date/fare columns. "
            f"Detected columns: {detected_list}."
        )

    parsed = pd.DataFrame()
    parsed["ride_date"] = pd.to_datetime(df[date_col], errors="coerce")
    parsed["fare_amount"] = df[fare_col].map(_as_number)

    if detected_columns["time"]:
        parsed["ride_time"] = df[detected_columns["time"]].astype(str)
    if detected_columns["origin"]:
        parsed["origin"] = df[detected_columns["origin"]].astype(str)
    if detected_columns["destination"]:
        parsed["destination"] = df[detected_columns["destination"]].astype(str)
    if detected_columns["ride_type"]:
        parsed["ride_type"] = df[detected_columns["ride_type"]].astype(str)

    parsed = parsed.dropna(subset=["ride_date", "fare_amount"]).copy()

    if parsed.empty:
        raise ParserError("No valid rides found after parsing date and fare fields.")

    return ParsedCSV(dataframe=parsed, detected_columns={k: v for k, v in detected_columns.items() if v})
