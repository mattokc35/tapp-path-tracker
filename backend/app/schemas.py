from __future__ import annotations

from pydantic import BaseModel


class DateRange(BaseModel):
    start: str
    end: str


class SummaryStats(BaseModel):
    total_rides: int
    total_spent: float
    average_fare: float
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


class RoutePoint(BaseModel):
    origin: str
    destination: str
    rides: int


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
    top_routes: list[RoutePoint]
    recommendation: Recommendation
    detected_columns: dict[str, str]
