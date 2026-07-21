"""Public contracts for explainable personal analytics."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class AnalyticsConstantsResponse(BaseModel):
    recency_half_life_days: float
    coverage_scale: float
    readiness_uncertainty_penalty: float


class SkillAnalyticsResponse(BaseModel):
    skill_id: str
    label: str
    blueprint_weight: float
    mastery: float | None
    confidence: float
    confidence_level: Literal["low_evidence", "developing", "established"]
    evidence_count: int
    effective_evidence: float
    attempt_count: int
    trend: Literal["insufficient_data", "improving", "stable", "declining"]
    trend_delta: float | None
    latest_observed_at: datetime | None


class ReadinessResponse(BaseModel):
    index: float | None
    raw_mastery: float | None
    confidence: float
    coverage: float
    status: Literal["no_data", "early_signal", "at_risk", "on_track", "ready"]
    pass_threshold: int
    explanation: str


class RecommendationResponse(BaseModel):
    exam_id: UUID | None = None
    action: str
    title: str
    reason: str
    target_skill_ids: list[str]
    confidence: float
    priority: float


class AdaptiveAnalyticsResponse(BaseModel):
    eligible: bool
    target_skill_ids: list[str]
    reason: str
    confidence_level: Literal["low_evidence", "developing", "established"]
    recommended_difficulty: Literal["matched"] = "matched"


class AnalyticsTrajectoryPointResponse(BaseModel):
    attempt_id: UUID
    observed_at: datetime
    score_percentage: float
    readiness_index: float | None
    readiness_confidence: float


class ExamAnalyticsResponse(BaseModel):
    model_version: str
    computed_at: datetime
    exam_id: UUID
    exam_title: str
    attempt_ids: list[UUID]
    constants: AnalyticsConstantsResponse
    readiness: ReadinessResponse
    skills: list[SkillAnalyticsResponse]
    trajectory: list[AnalyticsTrajectoryPointResponse]
    recommendations: list[RecommendationResponse]
    adaptive: AdaptiveAnalyticsResponse


class ExamAnalyticsSummaryResponse(BaseModel):
    exam_id: UUID
    exam_title: str
    target_date: str | None
    attempt_count: int
    latest_score_percentage: float | None
    readiness: ReadinessResponse
    top_skill: SkillAnalyticsResponse | None
    priority_skill: SkillAnalyticsResponse | None


class GlobalTrajectoryPointResponse(BaseModel):
    attempt_id: UUID
    exam_id: UUID
    exam_title: str
    observed_at: datetime
    score_percentage: float


class AnalyticsOverviewResponse(BaseModel):
    model_version: str
    computed_at: datetime
    total_attempts: int
    total_evaluated_questions: int
    established_skill_count: int
    developing_skill_count: int
    low_evidence_skill_count: int
    exams: list[ExamAnalyticsSummaryResponse]
    next_action: RecommendationResponse | None
    recent_trajectory: list[GlobalTrajectoryPointResponse] = Field(default_factory=list)
