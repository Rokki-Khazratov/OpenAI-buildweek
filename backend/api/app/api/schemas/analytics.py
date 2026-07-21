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
    timing_signal: Literal["not_used", "typical", "slow_but_correct"]


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
    policy_version: str
    target_reasons: dict[str, str] = Field(default_factory=dict)
    exploration_share: float = Field(ge=0, le=1)


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
    snapshot_id: UUID | None = None
    input_revision_hash: str | None = None


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


class AnalyticsRebuildResponse(BaseModel):
    exam_id: UUID
    observations_created: int
    snapshot_id: UUID | None
    input_revision_hash: str | None
    model_version: str
    equivalent_to_previous: bool | None


class AnalyticsDataQualityIssue(BaseModel):
    code: str
    severity: Literal["warning", "error"]
    count: int
    explanation: str


class AnalyticsDataQualityResponse(BaseModel):
    exam_id: UUID
    checked_at: datetime
    accepted_observations: int
    rejected_observations: int
    unknown_skill_rate: float
    issues: list[AnalyticsDataQualityIssue]
    safe_to_publish: bool


class AnalyticsOperationsResponse(BaseModel):
    model_version: str
    observation_count: int
    snapshot_count: int
    low_evidence_profile_share: float
    unknown_skill_rate: float
    latest_compute_latency_ms: float
    recommendation_action_distribution: dict[str, int]
    shadow_comparison_count: int
