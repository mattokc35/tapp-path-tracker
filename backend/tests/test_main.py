from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


SAMPLE_FILE = Path(__file__).resolve().parent / "fixtures" / "trip_history_sample.csv"


client = TestClient(app)


def test_upload_applies_pack_price_overrides() -> None:
    response = client.post(
        "/api/upload",
        files={"file": ("trip_history.csv", SAMPLE_FILE.read_bytes(), "text/csv")},
        data={
            "ten_trip_price": "29.00",
            "twenty_trip_price": "60.00",
            "forty_trip_price": "121.00",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["recommendation"]["overall"]["options"]["10-trip"] == 29.0
    assert payload["recommendation"]["overall"]["options"]["20-trip"] == 60.0
    assert payload["recommendation"]["overall"]["options"]["40-trip"] == 121.0
