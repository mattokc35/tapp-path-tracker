from __future__ import annotations

import pandas as pd

from app.pricing import build_recommendation, effective_cost_per_ride


DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _month_series(
    df: pd.DataFrame, value_column: str, output_key: str, agg: str = "count"
) -> list[dict]:
    grouped = df.groupby(df["ride_date"].dt.to_period("M"))
    if agg == "sum":
        values = grouped[value_column].sum()
    else:
        values = grouped[value_column].count()
    values = values.sort_index()
    return [{"month": str(month), output_key: round(float(value), 2)} for month, value in values.items()]


def _rides_by_location(df: pd.DataFrame) -> list[dict]:
    locations = (
        df[df["location"].str.strip() != ""]
        .groupby("location")
        .size()
        .sort_values(ascending=False)
        .head(10)
        .reset_index(name="rides")
    )
    return locations.to_dict(orient="records")


def _product_type_breakdown(
    df: pd.DataFrame, pack_price_overrides: dict[str, float] | None = None
) -> list[dict]:
    grouped = (
        df.groupby("product_type", dropna=False)
        .agg(rides=("reference", "count"), total_spend=("fare_amount", "sum"))
        .reset_index()
        .sort_values(["rides", "product_type"], ascending=[False, True])
    )

    breakdown: list[dict] = []
    for record in grouped.to_dict(orient="records"):
        per_ride = effective_cost_per_ride(record["product_type"], pack_price_overrides)
        breakdown.append(
            {
                "product_type": record["product_type"],
                "rides": int(record["rides"]),
                "total_spend": round(float(record["total_spend"]), 2),
                "effective_cost_per_ride": per_ride,
            }
        )

    return breakdown


def _serialize_trip_history(df: pd.DataFrame) -> list[dict]:
    rows: list[dict] = []
    for trip in df.sort_values("trip_time", ascending=False).to_dict(orient="records"):
        fare_amount = trip["fare_amount"]
        rows.append(
            {
                "reference": trip["reference"],
                "transit_account_number": trip["transit_account_number"],
                "trip_time": trip["trip_time"].isoformat(),
                "mode": trip["mode"],
                "location": trip["location"],
                "product_type": trip["product_type"],
                "fare_amount": None
                if pd.isna(fare_amount)
                else round(float(fare_amount), 2),
            }
        )
    return rows


def analyze_rides(
    df: pd.DataFrame, pack_price_overrides: dict[str, float] | None = None
) -> dict:
    start_date = df["ride_date"].min().date().isoformat()
    end_date = df["ride_date"].max().date().isoformat()
    stored_value_rides = int(df["fare_amount"].notna().sum())
    pass_ride_count = int(len(df) - stored_value_rides)
    average_stored_value_fare = (
        float(df["fare_amount"].dropna().mean()) if stored_value_rides else 0.0
    )

    rides_by_day = (
        df["ride_date"]
        .dt.day_name()
        .value_counts()
        .reindex(DAY_ORDER, fill_value=0)
        .rename_axis("day")
        .reset_index(name="rides")
    )

    return {
        "summary": {
            "total_rides": int(len(df)),
            "total_spent": round(float(df["fare_amount"].fillna(0).sum()), 2),
            "average_stored_value_fare": round(average_stored_value_fare, 2),
            "stored_value_ride_count": stored_value_rides,
            "pass_ride_count": pass_ride_count,
            "date_range": {"start": start_date, "end": end_date},
        },
        "rides_per_month": _month_series(df, "reference", output_key="rides", agg="count"),
        "spend_per_month": _month_series(
            df.fillna({"fare_amount": 0.0}),
            "fare_amount",
            output_key="spend",
            agg="sum",
        ),
        "rides_by_day_of_week": rides_by_day.to_dict(orient="records"),
        "rides_by_location": _rides_by_location(df),
        "product_type_breakdown": _product_type_breakdown(df, pack_price_overrides),
        "trip_history": _serialize_trip_history(df),
        "recommendation": build_recommendation(df, pack_price_overrides=pack_price_overrides),
    }
