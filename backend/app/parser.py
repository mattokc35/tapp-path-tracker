from __future__ import annotations

import io
import re
from dataclasses import dataclass

import pandas as pd


class ParserError(ValueError):
    """Raised when required CSV columns cannot be identified."""


@dataclass
class ParsedCSV:
    dataframe: pd.DataFrame
    detected_columns: dict[str, str]


COLUMN_ALIASES: dict[str, list[str]] = {
    "reference": ["Reference"],
    "transit_account_number": ["Transit Account #", "Transit Account#"],
    "trip_time": ["Trip time", "Trip Time"],
    "mode": ["Mode"],
    "location": ["Location"],
    "product_type": ["Product Type"],
    "fare_amount": ["Fare Amount ($)", "Fare Amount"],
}


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", str(text).strip().lower())).strip()


def _detect_column(columns: list[str], aliases: list[str]) -> str | None:
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


def _clean_transit_account_number(value: object) -> str:
    cleaned = str(value).strip()
    if cleaned.startswith('="') and cleaned.endswith('"'):
        return cleaned[2:-1]
    return cleaned.strip('"')


def _parse_fare_amount(value: object) -> float:
    cleaned = str(value).strip()
    if cleaned in {"", "-", "—"}:
        return float("nan")
    cleaned = cleaned.replace("$", "").replace(",", "")
    try:
        return float(cleaned)
    except ValueError:
        return float("nan")


def parse_rides_csv(contents: bytes) -> ParsedCSV:
    try:
        df = pd.read_csv(io.BytesIO(contents), dtype=str, keep_default_na=False)
    except Exception as exc:  # pragma: no cover - parser-specific error text varies
        raise ParserError(f"Could not parse CSV file: {exc}") from exc

    if df.empty:
        raise ParserError("Uploaded CSV is empty.")

    detected_columns = {
        field: _detect_column(list(df.columns), aliases) for field, aliases in COLUMN_ALIASES.items()
    }
    missing = [field for field, column in detected_columns.items() if not column]
    if missing:
        detected_list = ", ".join(str(c) for c in df.columns)
        raise ParserError(
            "Could not identify required columns for the PATH TAPP export: "
            f"{', '.join(missing)}. Detected columns: {detected_list}."
        )

    parsed = pd.DataFrame()
    parsed["reference"] = df[detected_columns["reference"]].astype(str).str.strip()
    parsed["transit_account_number"] = (
        df[detected_columns["transit_account_number"]].map(_clean_transit_account_number).astype(str)
    )
    parsed["trip_time"] = pd.to_datetime(
        df[detected_columns["trip_time"]],
        format="%Y-%m-%d %I:%M %p",
        errors="coerce",
    )
    parsed["ride_date"] = parsed["trip_time"]
    parsed["date"] = parsed["trip_time"].dt.strftime("%Y-%m-%d")
    parsed["time"] = parsed["trip_time"].dt.strftime("%I:%M %p").str.lstrip("0")
    parsed["day_of_week"] = parsed["trip_time"].dt.day_name()
    parsed["hour"] = parsed["trip_time"].dt.hour
    parsed["mode"] = df[detected_columns["mode"]].astype(str).str.strip()
    parsed["location"] = df[detected_columns["location"]].astype(str).str.strip()
    parsed["product_type"] = df[detected_columns["product_type"]].astype(str).str.strip()
    parsed["fare_amount"] = df[detected_columns["fare_amount"]].map(_parse_fare_amount)

    parsed = parsed.dropna(subset=["trip_time"]).copy()

    if parsed.empty:
        raise ParserError("No valid rides found after parsing the Trip time column.")

    return ParsedCSV(dataframe=parsed, detected_columns={k: v for k, v in detected_columns.items() if v})
