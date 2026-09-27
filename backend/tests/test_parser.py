from pathlib import Path

import pytest

from app.parser import ParserError, parse_rides_csv


SAMPLE_FILE = Path(__file__).resolve().parents[1] / "sample_data" / "sample_rides.csv"


def test_parse_sample_csv_success() -> None:
    parsed = parse_rides_csv(SAMPLE_FILE.read_bytes())
    assert len(parsed.dataframe) == 88
    assert "date" in parsed.detected_columns
    assert "fare" in parsed.detected_columns


def test_parse_missing_required_columns() -> None:
    bad_csv = b"origin,destination\nA,B\n"
    with pytest.raises(ParserError):
        parse_rides_csv(bad_csv)


def test_parse_with_defensive_header_detection() -> None:
    defensive_headers = b"Ride Date (Local),Fare Amount USD,From Station,To Station\n2025-01-01,$2.75,A,B\n"
    parsed = parse_rides_csv(defensive_headers)
    assert len(parsed.dataframe) == 1
    assert parsed.detected_columns["date"] == "Ride Date (Local)"
    assert parsed.detected_columns["fare"] == "Fare Amount USD"
