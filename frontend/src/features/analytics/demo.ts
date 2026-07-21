import type { Exam } from "@/features/exams/types";

import type {
  AnalyticsOverview,
  ConfidenceLevel,
  ExamAnalytics,
  SkillAnalytics,
} from "./types";

const DEMO_COMPUTED_AT = "2026-07-21T09:00:00.000Z";

const MODEL_VERSION = "analytics.v1-demo";

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function level(confidence: number): ConfidenceLevel {
  if (confidence < 0.35) return "low_evidence";
  if (confidence < 0.7) return "developing";
  return "established";
}

export function demoExamAnalytics(exam: Exam): ExamAnalytics {
  const latest = exam.attempts.at(-1);
  const latestPercentage = latest
    ? Math.round((latest.score / Math.max(1, latest.maxScore)) * 100)
    : null;
  const confidence = Math.min(0.86, exam.attempts.length * 0.18);
  const blueprint = exam.blueprint?.length
    ? exam.blueprint
    : [{ id: "core", title: "Core knowledge", questionType: "Open response", questionCount: 1, durationMinutes: 1, points: exam.rules?.totalPoints ?? 100 }];
  const sectionWeightTotal = blueprint.reduce((sum, item) => sum + item.points, 0) || 1;
  const skills: SkillAnalytics[] = blueprint.map((section, index) => {
    const offset = index === 1 ? -0.14 : index === 2 ? -0.05 : 0.07;
    const mastery = latestPercentage === null ? null : Math.max(0.18, Math.min(0.95, latestPercentage / 100 + offset));
    return {
      skill_id: slug(section.title) || section.id,
      label: section.title,
      blueprint_weight: section.points / sectionWeightTotal,
      mastery,
      confidence,
      confidence_level: level(confidence),
      evidence_count: exam.attempts.length * section.questionCount,
      effective_evidence: exam.attempts.length * section.questionCount * 0.82,
      attempt_count: exam.attempts.length,
      trend: exam.attempts.length < 3 ? "insufficient_data" : "stable",
      trend_delta: null,
      latest_observed_at: latest ? DEMO_COMPUTED_AT : null,
    };
  });
  const priority = [...skills].sort(
    (a, b) =>
      b.blueprint_weight * (1 - (b.mastery ?? 0.5)) -
      a.blueprint_weight * (1 - (a.mastery ?? 0.5)),
  )[0];
  const readinessIndex =
    latestPercentage === null
      ? null
      : Math.max(0, Math.round(latestPercentage - (1 - confidence) * 15));
  const readiness = {
    index: readinessIndex,
    raw_mastery: latestPercentage === null ? null : latestPercentage / 100,
    confidence,
    coverage: latestPercentage === null ? 0 : 1,
    status: latestPercentage === null ? "no_data" as const : confidence < 0.35 ? "early_signal" as const : readinessIndex! < (exam.rules?.passPercentage ?? 50) ? "at_risk" as const : "on_track" as const,
    pass_threshold: exam.rules?.passPercentage ?? 50,
    explanation: latestPercentage === null
      ? "Complete a mock to create the first readiness signal."
      : `Readiness is most limited by ${priority?.label ?? "the current evidence"}.`,
  };
  return {
    model_version: MODEL_VERSION,
    computed_at: DEMO_COMPUTED_AT,
    exam_id: exam.id,
    exam_title: exam.title,
    attempt_ids: exam.attempts.map((item) => item.id),
    constants: {
      recency_half_life_days: 30,
      coverage_scale: 3,
      readiness_uncertainty_penalty: 15,
    },
    readiness,
    skills,
    trajectory: exam.attempts.map((item) => ({
      attempt_id: item.id,
      observed_at: DEMO_COMPUTED_AT,
      score_percentage: Math.round((item.score / Math.max(1, item.maxScore)) * 100),
      readiness_index: readinessIndex,
      readiness_confidence: confidence,
    })),
    recommendations: latestPercentage === null ? [{
      exam_id: exam.id,
      action: "run_full_mock",
      title: "Complete a diagnostic mock",
      reason: "No evaluated evidence exists yet, so readiness cannot be estimated reliably.",
      target_skill_ids: [],
      confidence: 0,
      priority: 1,
    }] : [{
      exam_id: exam.id,
      action: confidence < 0.35 ? "collect_evidence" : "practice_weak_skill",
      title: `${confidence < 0.35 ? "Collect more evidence for" : "Practice"} ${priority.label}`,
      reason: `${Math.round((priority.mastery ?? 0) * 100)}% mastery · ${Math.round(priority.blueprint_weight * 100)}% of the blueprint.`,
      target_skill_ids: [priority.skill_id],
      confidence,
      priority: priority.blueprint_weight * (1 - (priority.mastery ?? 0.5)),
    }],
    adaptive: {
      eligible: latestPercentage !== null,
      target_skill_ids: latestPercentage === null ? [] : [priority.skill_id],
      reason: latestPercentage === null
        ? "Complete a diagnostic mock before generating an adaptive target set."
        : "This mock targets the highest-impact skill limiting readiness.",
      confidence_level: level(confidence),
      recommended_difficulty: "matched",
    },
  };
}

export function demoAnalyticsOverview(exams: Exam[]): AnalyticsOverview {
  const profiles = exams.map(demoExamAnalytics);
  const skills = profiles.flatMap((item) => item.skills);
  const recommendations = profiles.flatMap((item) => item.recommendations);
  return {
    model_version: MODEL_VERSION,
    computed_at: DEMO_COMPUTED_AT,
    total_attempts: profiles.reduce((sum, item) => sum + item.attempt_ids.length, 0),
    total_evaluated_questions: skills.reduce((sum, item) => sum + item.evidence_count, 0),
    established_skill_count: skills.filter((item) => item.confidence_level === "established").length,
    developing_skill_count: skills.filter((item) => item.confidence_level === "developing").length,
    low_evidence_skill_count: skills.filter((item) => item.confidence_level === "low_evidence").length,
    exams: exams.map((exam, index) => ({
      exam_id: exam.id,
      exam_title: exam.title,
      target_date: exam.targetDate || null,
      attempt_count: profiles[index].attempt_ids.length,
      latest_score_percentage: profiles[index].trajectory.at(-1)?.score_percentage ?? null,
      readiness: profiles[index].readiness,
      top_skill: [...profiles[index].skills].sort((a, b) => (b.mastery ?? 0) - (a.mastery ?? 0))[0] ?? null,
      priority_skill: profiles[index].skills.find((item) => profiles[index].adaptive.target_skill_ids.includes(item.skill_id)) ?? null,
    })),
    next_action: recommendations.sort((a, b) => b.priority - a.priority)[0] ?? null,
    recent_trajectory: exams.flatMap((exam) => exam.attempts.map((attempt) => ({
      attempt_id: attempt.id,
      exam_id: exam.id,
      exam_title: exam.title,
      observed_at: DEMO_COMPUTED_AT,
      score_percentage: Math.round((attempt.score / Math.max(1, attempt.maxScore)) * 100),
    }))),
  };
}
