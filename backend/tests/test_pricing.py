from pathlib import Path

from app.analysis import analyze_rides
from app.parser import parse_rides_csv
from app.pricing import build_recommendation


SAMPLE_FILE = Path(__file__).resolve().parent / "fixtures" / "trip_history_sample.csv"


def test_analysis_summarizes_stored_value_and_pass_rides() -> None:
    parsed = parse_rides_csv(SAMPLE_FILE.read_bytes())
    analysis = analyze_rides(parsed.dataframe)

    assert analysis["summary"]["total_rides"] == 8
    assert analysis["summary"]["total_spent"] == 13.0
    assert analysis["summary"]["average_stored_value_fare"] == 3.25
    assert analysis["summary"]["stored_value_ride_count"] == 4
    assert analysis["summary"]["pass_ride_count"] == 4
    assert analysis["rides_by_location"][0] == {"location": "Grove Street", "rides": 2}
    product_breakdown = {
        entry["product_type"]: entry for entry in analysis["product_type_breakdown"]
    }
    assert product_breakdown["Stored Value"]["rides"] == 4
    assert product_breakdown["40-Trip"]["rides"] == 3
    assert product_breakdown["20-Trip"]["effective_cost_per_ride"] == 3.1
    assert analysis["trip_history"][0]["reference"] == "104390291"
    assert analysis["trip_history"][1]["fare_amount"] is None


def test_recommendation_allows_pack_price_overrides() -> None:
    parsed = parse_rides_csv(SAMPLE_FILE.read_bytes())

    recommendation = build_recommendation(
        parsed.dataframe,
        pack_price_overrides={"10-trip": 30.0, "20-trip": 70.0, "40-trip": 120.0},
    )

    overall = recommendation["overall"]
    assert overall["best_option"] == "pay_per_ride"
    assert overall["options"]["10-trip"] == 30.0
    assert overall["options"]["20-trip"] == 70.0
    assert overall["options"]["40-trip"] == 120.0
