from pathlib import Path

from app.analysis import analyze_rides
from app.parser import parse_rides_csv


SAMPLE_FILE = Path(__file__).resolve().parents[1] / "sample_data" / "sample_rides.csv"


def test_recommendation_has_expected_shape() -> None:
    parsed = parse_rides_csv(SAMPLE_FILE.read_bytes())
    analysis = analyze_rides(parsed.dataframe)

    overall = analysis["recommendation"]["overall"]
    assert "best_option" in overall
    assert "pay_per_ride" in overall["options"]
    assert "10-trip" in overall["options"]
    assert "20-trip" in overall["options"]
    assert "40-trip" in overall["options"]
    assert "unlimited_1_day_pass_all_active_days" in overall["options"]
    assert "unlimited_7_day_pass_all_active_weeks" in overall["options"]
    assert "unlimited_30_day_pass_all_active_months" in overall["options"]
    assert "unlimited_30_day_pass_or_best_monthly_alternative" in overall["options"]
    assert analysis["summary"]["total_rides"] == 88
    assert len(analysis["recommendation"]["per_month"]) == 12
    assert overall["best_option"] == "10-trip"
    assert overall["options"]["pay_per_ride"] == 286.0
    assert overall["options"]["10-trip"] == 279.0
