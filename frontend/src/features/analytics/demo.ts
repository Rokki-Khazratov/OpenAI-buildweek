import type { Exam } from "@/features/exams/types";

import type {
  AnalyticsOverview,
  ConfidenceLevel,
  ExamAnalytics,
  SkillAnalytics,
} from "./types";

const DEMO_COMPUTED_AT = "2026-07-21T09:00:00.000Z";

const MODEL_VERSION = "analytics.v1-demo";

type DemoSkillFixture = {
  skill_id: string;
  label: string;
  blueprint_weight: number;
  scores: Array<number | null>;
  evidence_per_attempt: number;
};

const DEMO_SKILL_FIXTURES: Record<string, DemoSkillFixture[]> = {
  "algorithms-final": [
    { skill_id: "dynamic-programming", label: "Dynamic programming", blueprint_weight: 0.3, scores: [0.35, 0.48, 0.58], evidence_per_attempt: 2 },
    { skill_id: "graph-algorithms", label: "Graph algorithms", blueprint_weight: 0.3, scores: [0.75, 0.62, 0.5], evidence_per_attempt: 2 },
    { skill_id: "complexity", label: "Complexity", blueprint_weight: 0.25, scores: [0.85, 0.88, 0.9], evidence_per_attempt: 2 },
    { skill_id: "recursion", label: "Recursion", blueprint_weight: 0.15, scores: [null, null, 0.7], evidence_per_attempt: 1 },
  ],
};

function demoObservedAt(examId: string, attemptIndex: number) {
  const day = examId === "algorithms-final" ? 14 + attemptIndex * 3 : 13 + attemptIndex * 2;
  return `2026-07-${String(day).padStart(2, "0")}T18:00:00.000Z`;
}

function fixtureTrend(scores: Array<number | null>): Pick<SkillAnalytics, "trend" | "trend_delta"> {
  const values = scores.filter((score): score is number => score !== null);
  if (values.length < 3) return { trend: "insufficient_data", trend_delta: null };
  const delta = (values.at(-1)! + values.at(-2)!) / 2 - (values[0] + values[1]) / 2;
  return {
    trend: delta >= 0.08 ? "improving" : delta <= -0.08 ? "declining" : "stable",
    trend_delta: Math.round(delta * 10000) / 10000,
  };
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function level(confidence: number): ConfidenceLevel {
  if (confidence < 0.35) return "low_evidence";
  if (confidence < 0.7) return "developing";
  return "established";
}

export function demoExamAnalytics(exam: Exam): ExamAnalytics {
  const latest = exam.attempts[0];
  const latestPercentage = latest
    ? Math.round((latest.score / Math.max(1, latest.maxScore)) * 100)
    : null;
  const defaultConfidence = Math.min(0.86, exam.attempts.length * 0.18);
  const fixture = DEMO_SKILL_FIXTURES[exam.id];
  const blueprint = exam.blueprint?.length
    ? exam.blueprint
    : [{ id: "core", title: "Core knowledge", questionType: "Open response", questionCount: 1, durationMinutes: 1, points: exam.rules?.totalPoints ?? 100 }];
  const sectionWeightTotal = blueprint.reduce((sum, item) => sum + item.points, 0) || 1;
  const blueprintSkills: SkillAnalytics[] = blueprint.map((section, index) => {
    const offset = index === 1 ? -0.14 : index === 2 ? -0.05 : 0.07;
    const mastery = latestPercentage === null ? null : Math.max(0.18, Math.min(0.95, latestPercentage / 100 + offset));
    return {
      skill_id: slug(section.title) || section.id,
      label: section.title,
      blueprint_weight: section.points / sectionWeightTotal,
      mastery,
      confidence: defaultConfidence,
      confidence_level: level(defaultConfidence),
      evidence_count: exam.attempts.length * section.questionCount,
      effective_evidence: exam.attempts.length * section.questionCount * 0.82,
      attempt_count: exam.attempts.length,
      trend: exam.attempts.length < 3 ? "insufficient_data" : "stable",
      trend_delta: null,
      latest_observed_at: latest ? DEMO_COMPUTED_AT : null,
    };
  });
  const fixtureSkills: SkillAnalytics[] | null = fixture ? fixture.map((item) => {
    const observed = item.scores
      .map((score, index) => score === null ? null : { score, index })
      .filter((value): value is { score: number; index: number } => value !== null);
    const evidenceCount = observed.length * item.evidence_per_attempt;
    const confidence = evidenceCount >= 6 ? 0.76 : evidenceCount >= 3 ? 0.56 : 0.24;
    const mastery = observed.length
      ? observed.reduce((sum, value) => sum + value.score, 0) / observed.length
      : null;
    return {
      skill_id: item.skill_id,
      label: item.label,
      blueprint_weight: item.blueprint_weight,
      mastery,
      confidence,
      confidence_level: level(confidence),
      evidence_count: evidenceCount,
      effective_evidence: Math.round(evidenceCount * 0.82 * 100) / 100,
      attempt_count: observed.length,
      ...fixtureTrend(item.scores),
      latest_observed_at: observed.length ? demoObservedAt(exam.id, observed.at(-1)!.index) : null,
    };
  }) : null;
  const skills = fixtureSkills ?? blueprintSkills;
  const confidence = fixtureSkills
    ? fixtureSkills.reduce((sum, skill) => sum + skill.confidence * skill.blueprint_weight, 0)
    : defaultConfidence;
  const priority = [...skills].sort(
    (a, b) =>
      b.blueprint_weight * (1 - (b.mastery ?? 0.5)) -
      a.blueprint_weight * (1 - (a.mastery ?? 0.5)),
  )[0];
  const rawMastery = fixtureSkills
    ? fixtureSkills.reduce((sum, skill) => sum + (skill.mastery ?? 0.5) * skill.blueprint_weight, 0)
    : latestPercentage === null ? null : latestPercentage / 100;
  const readinessIndex = rawMastery === null
    ? null
    : Math.max(0, Math.round(rawMastery * 100 - (1 - confidence) * 15));
  const readiness = {
    index: readinessIndex,
    raw_mastery: rawMastery,
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
    trajectory: [...exam.attempts].reverse().map((item, index) => {
      const trajectoryConfidence = Math.min(0.86, (index + 1) * 0.24);
      const scorePercentage = Math.round((item.score / Math.max(1, item.maxScore)) * 100);
      return {
      attempt_id: item.id,
      observed_at: demoObservedAt(exam.id, index),
      score_percentage: scorePercentage,
      readiness_index: Math.max(0, Math.round(scorePercentage - (1 - trajectoryConfidence) * 15)),
      readiness_confidence: trajectoryConfidence,
    };
    }),
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
    recent_trajectory: exams.flatMap((exam) => [...exam.attempts].reverse().map((attempt, index) => ({
      attempt_id: attempt.id,
      exam_id: exam.id,
      exam_title: exam.title,
      observed_at: demoObservedAt(exam.id, index),
      score_percentage: Math.round((attempt.score / Math.max(1, attempt.maxScore)) * 100),
    }))),
  };
}
