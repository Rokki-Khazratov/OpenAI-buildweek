export type ConfidenceLevel = "low_evidence" | "developing" | "established";
export type Trend = "insufficient_data" | "improving" | "stable" | "declining";

export type Readiness = {
  index: number | null;
  raw_mastery: number | null;
  confidence: number;
  coverage: number;
  status: "no_data" | "early_signal" | "at_risk" | "on_track" | "ready";
  pass_threshold: number;
  explanation: string;
};

export type SkillAnalytics = {
  skill_id: string;
  label: string;
  blueprint_weight: number;
  mastery: number | null;
  confidence: number;
  confidence_level: ConfidenceLevel;
  evidence_count: number;
  effective_evidence: number;
  attempt_count: number;
  trend: Trend;
  trend_delta: number | null;
  latest_observed_at: string | null;
};

export type Recommendation = {
  exam_id: string | null;
  action: string;
  title: string;
  reason: string;
  target_skill_ids: string[];
  confidence: number;
  priority: number;
};

export type ExamAnalytics = {
  model_version: string;
  computed_at: string;
  exam_id: string;
  exam_title: string;
  attempt_ids: string[];
  constants: {
    recency_half_life_days: number;
    coverage_scale: number;
    readiness_uncertainty_penalty: number;
  };
  readiness: Readiness;
  skills: SkillAnalytics[];
  trajectory: Array<{
    attempt_id: string;
    observed_at: string;
    score_percentage: number;
    readiness_index: number | null;
    readiness_confidence: number;
  }>;
  recommendations: Recommendation[];
  adaptive: {
    eligible: boolean;
    target_skill_ids: string[];
    reason: string;
    confidence_level: ConfidenceLevel;
    recommended_difficulty: "matched";
  };
};

export type AnalyticsOverview = {
  model_version: string;
  computed_at: string;
  total_attempts: number;
  total_evaluated_questions: number;
  established_skill_count: number;
  developing_skill_count: number;
  low_evidence_skill_count: number;
  exams: Array<{
    exam_id: string;
    exam_title: string;
    target_date: string | null;
    attempt_count: number;
    latest_score_percentage: number | null;
    readiness: Readiness;
    top_skill: SkillAnalytics | null;
    priority_skill: SkillAnalytics | null;
  }>;
  next_action: Recommendation | null;
  recent_trajectory: Array<{
    attempt_id: string;
    exam_id: string;
    exam_title: string;
    observed_at: string;
    score_percentage: number;
  }>;
};
