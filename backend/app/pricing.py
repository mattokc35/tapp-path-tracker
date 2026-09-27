from __future__ import annotations

from dataclasses import dataclass
from math import ceil

import pandas as pd

# Placeholder pricing constants. Verify and update these with current NJ Transit PATH fares.
SINGLE_RIDE_FARE = 2.75
MONTHLY_PASS_PRICE = 100.0
PACK_OPTIONS = [
    {"name": "10-ride pack", "rides": 10, "price": 26.0},
    {"name": "20-ride pack", "rides": 20, "price": 50.0},
]


@dataclass
class CostOption:
    name: str
    cost: float


def _pack_cost(rides: int, pack_rides: int, pack_price: float) -> float:
    return ceil(rides / pack_rides) * pack_price if rides > 0 else 0.0


def _pick_best(options: list[CostOption]) -> tuple[CostOption, float]:
    ordered = sorted(options, key=lambda o: o.cost)
    best = ordered[0]
    second = ordered[1] if len(ordered) > 1 else ordered[0]
    savings = max(0.0, second.cost - best.cost)
    return best, savings


def _month_recommendation(month: str, rides: int) -> dict:
    options = [CostOption("pay_per_ride", rides * SINGLE_RIDE_FARE)]
    for pack in PACK_OPTIONS:
        options.append(CostOption(pack["name"], _pack_cost(rides, pack["rides"], pack["price"])))
    options.append(CostOption("monthly_pass", MONTHLY_PASS_PRICE if rides > 0 else 0.0))

    best, savings = _pick_best(options)
    return {
        "month": month,
        "rides": rides,
        "best_option": best.name,
        "savings_vs_next_best": round(savings, 2),
        "options": {opt.name: round(opt.cost, 2) for opt in options},
    }


def build_recommendation(df: pd.DataFrame) -> dict:
    rides = len(df)
    month_counts = (
        df.groupby(df["ride_date"].dt.to_period("M")).size().sort_index().rename("rides").astype(int)
    )
    active_months = int((month_counts > 0).sum())

    pay_per_ride = rides * SINGLE_RIDE_FARE

    options = [CostOption("pay_per_ride", pay_per_ride)]
    for pack in PACK_OPTIONS:
        options.append(CostOption(pack["name"], _pack_cost(rides, pack["rides"], pack["price"])))

    monthly_all_active = MONTHLY_PASS_PRICE * active_months
    monthly_pass_or_best_monthly_alternative = 0.0
    for _, month_rides in month_counts.items():
        non_pass_options = [month_rides * SINGLE_RIDE_FARE]
        for pack in PACK_OPTIONS:
            non_pass_options.append(_pack_cost(month_rides, pack["rides"], pack["price"]))
        cheapest_non_pass = min(non_pass_options)
        monthly_pass_or_best_monthly_alternative += min(MONTHLY_PASS_PRICE, cheapest_non_pass)

    options.append(CostOption("monthly_pass_all_active_months", monthly_all_active))
    options.append(
        CostOption(
            "monthly_pass_or_best_monthly_alternative",
            monthly_pass_or_best_monthly_alternative,
        )
    )

    best, savings = _pick_best(options)

    avg_rides_per_month = float(month_counts.mean()) if not month_counts.empty else 0.0
    reasoning = (
        f"You averaged {avg_rides_per_month:.1f} rides/month. "
        f"{best.name} is estimated to save ${savings:.2f} versus the next best option."
    )

    per_month = [
        _month_recommendation(str(month), int(count))
        for month, count in month_counts.items()
    ]

    return {
        "overall": {
            "best_option": best.name,
            "reasoning": reasoning,
            "savings_vs_next_best": round(savings, 2),
            "options": {opt.name: round(opt.cost, 2) for opt in options},
        },
        "per_month": per_month,
    }
