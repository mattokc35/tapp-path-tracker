from __future__ import annotations

from pydantic import BaseModel


class DateRange(BaseModel):
    start: str
    end: str


class SummaryStats(BaseModel):
    total_rides: int
    total_spent: float
    average_stored_value_fare: float
    stored_value_ride_count: int
    pass_ride_count: int
    date_range: DateRange


class MonthlyRidesPoint(BaseModel):
    month: str
    rides: int


class MonthlySpendPoint(BaseModel):
    month: str
    spend: float


class DayOfWeekPoint(BaseModel):
    day: str
    rides: int


class LocationPoint(BaseModel):
    location: str
    rides: int


class ProductTypeBreakdownPoint(BaseModel):
    product_type: str
    rides: int
    total_spend: float
    effective_cost_per_ride: float | None


class TripRecord(BaseModel):
    reference: str
    transit_account_number: str
    trip_time: str
    mode: str
    location: str
    product_type: str
    fare_amount: float | None


class MonthRecommendation(BaseModel):
    month: str
    rides: int
    best_option: str
    savings_vs_next_best: float
    options: dict[str, float]


class OverallRecommendation(BaseModel):
    best_option: str
    reasoning: str
    savings_vs_next_best: float
    options: dict[str, float]


class Recommendation(BaseModel):
    overall: OverallRecommendation
    per_month: list[MonthRecommendation]


class AnalysisResponse(BaseModel):
    summary: SummaryStats
    rides_per_month: list[MonthlyRidesPoint]
    spend_per_month: list[MonthlySpendPoint]
    rides_by_day_of_week: list[DayOfWeekPoint]
    rides_by_location: list[LocationPoint]
    product_type_breakdown: list[ProductTypeBreakdownPoint]
    trip_history: list[TripRecord]
    recommendation: Recommendation
    detected_columns: dict[str, str]
