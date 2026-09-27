from pathlib import Path

import pandas as pd
import pytest

from app.parser import ParserError, parse_rides_csv


SAMPLE_FILE = Path(__file__).resolve().parent / "fixtures" / "trip_history_sample.csv"


def test_parse_sample_csv_success() -> None:
    parsed = parse_rides_csv(SAMPLE_FILE.read_bytes())

    assert len(parsed.dataframe) == 8
    assert parsed.detected_columns["trip_time"] == "Trip time"
    assert parsed.detected_columns["fare_amount"] == "Fare Amount ($)"

    first_row = parsed.dataframe.iloc[0]
    second_row = parsed.dataframe.iloc[1]
    assert first_row["transit_account_number"] == "100060443445"
    assert first_row["trip_time"].isoformat() == "2026-09-13T10:26:00"
    assert first_row["fare_amount"] == 3.25
    assert pd.isna(second_row["fare_amount"])
    assert first_row["day_of_week"] == "Sunday"
    assert first_row["hour"] == 10


def test_parse_missing_required_columns() -> None:
    bad_csv = b"Reference,Trip time,Mode,Location,Product Type\n1,2026-09-13 10:26 AM,Rail,Grove Street,Stored Value\n"
    with pytest.raises(ParserError):
        parse_rides_csv(bad_csv)


def test_parse_with_exact_export_headers() -> None:
    exported_headers = (
        b'Reference,Transit Account #,Trip time,Mode,Location,Product Type,Fare Amount ($)\n'
        b'1,"=""100060443445""",2026-09-13 10:26 AM,Rail,Grove Street,Stored Value,$3.25\n'
    )
    parsed = parse_rides_csv(exported_headers)

    assert len(parsed.dataframe) == 1
    assert parsed.detected_columns["reference"] == "Reference"
    assert parsed.detected_columns["transit_account_number"] == "Transit Account #"
