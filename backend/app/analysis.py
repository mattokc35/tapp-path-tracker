from __future__ import annotations

import pandas as pd

from app.pricing import build_recommendation


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


def analyze_rides(df: pd.DataFrame) -> dict:
    start_date = df["ride_date"].min().date().isoformat()
    end_date = df["ride_date"].max().date().isoformat()

    rides_by_day = (
        df["ride_date"]
        .dt.day_name()
        .value_counts()
        .reindex(DAY_ORDER, fill_value=0)
        .rename_axis("day")
        .reset_index(name="rides")
    )

    top_routes: list[dict] = []
    if {"origin", "destination"}.issubset(df.columns):
        routes = (
            df[(df["origin"].str.strip() != "") & (df["destination"].str.strip() != "")]
            .groupby(["origin", "destination"])
            .size()
            .sort_values(ascending=False)
            .head(10)
            .reset_index(name="rides")
        )
        top_routes = routes.to_dict(orient="records")

    return {
        "summary": {
            "total_rides": int(len(df)),
            "total_spent": round(float(df["fare_amount"].sum()), 2),
            "average_fare": round(float(df["fare_amount"].mean()), 2),
            "date_range": {"start": start_date, "end": end_date},
        },
        "rides_per_month": _month_series(df, "fare_amount", output_key="rides", agg="count"),
        "spend_per_month": _month_series(df, "fare_amount", output_key="spend", agg="sum"),
        "rides_by_day_of_week": rides_by_day.to_dict(orient="records"),
        "top_routes": top_routes,
        "recommendation": build_recommendation(df),
    }
