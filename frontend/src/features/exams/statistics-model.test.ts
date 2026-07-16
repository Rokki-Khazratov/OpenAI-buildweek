import { describe, expect, it } from "vitest";

import type { AttemptSummaryDto, ExamStatisticsDto } from "./api";
import {
  statisticsViewFromApi,
  statisticsViewFromDemoAttempts,
} from "./statistics-model";

const statistics: ExamStatisticsDto = {
  exam_id: "exam-1",
  attempt_count: 2,
  average_percentage: 72,
  best_percentage: 80,
  latest_percentage: 64,
  average_duration_seconds: 510,
  low_confidence: true,
};

const attempts: AttemptSummaryDto[] = [
  {
    attempt_id: "latest",
    exam_id: "exam-1",
    status: "evaluated",
    score: 16,
    max_score: 25,
    percentage: 64,
    passed: true,
    duration_seconds: 420,
    submitted_at: "2026-07-16T10:00:00Z",
    feedback: "Latest",
  },
  {
    attempt_id: "older",
    exam_id: "exam-1",
    status: "evaluated",
    score: 20,
    max_score: 25,
    percentage: 80,
    passed: true,
    duration_seconds: 600,
    submitted_at: "2026-07-15T10:00:00Z",
    feedback: "Older",
  },
];

describe("statisticsViewFromApi", () => {
  it("maps the exact backend snake_case contract without recomputing aggregates", () => {
    const view = statisticsViewFromApi(statistics, attempts);

    expect(Object.keys(statistics).sort()).toEqual([
      "attempt_count",
      "average_duration_seconds",
      "average_percentage",
      "best_percentage",
      "exam_id",
      "latest_percentage",
      "low_confidence",
    ]);
    expect(Object.keys(attempts[0]).sort()).toEqual([
      "attempt_id",
      "duration_seconds",
      "exam_id",
      "feedback",
      "max_score",
      "passed",
      "percentage",
      "score",
      "status",
      "submitted_at",
    ]);
    expect(view).toMatchObject({
      attemptCount: 2,
      averagePercentage: 72,
      bestPercentage: 80,
      latestPercentage: 64,
      averageDurationLabel: "8 min 30 s",
      lowConfidence: true,
    });
    expect(view.history.map((point) => [point.id, point.percentage])).toEqual([
      ["older", 80],
      ["latest", 64],
    ]);
  });

  it("keeps valid no-attempt backend nulls as empty display values", () => {
    const view = statisticsViewFromApi({
      exam_id: "exam-1",
      attempt_count: 0,
      average_percentage: null,
      best_percentage: null,
      latest_percentage: null,
      average_duration_seconds: null,
      low_confidence: true,
    });

    expect(view).toMatchObject({
      attemptCount: 0,
      averagePercentage: null,
      bestPercentage: null,
      latestPercentage: null,
      averageDurationLabel: null,
      history: [],
    });
  });

  it("uses the same shape for local demo attempts", () => {
    const view = statisticsViewFromDemoAttempts([
      {
        id: "demo-1",
        examId: "exam-1",
        score: 9,
        maxScore: 10,
        durationMinutes: 12,
        completedAt: "16 Jul 2026",
        feedback: "",
        answers: {},
      },
    ]);

    expect(view).toMatchObject({
      attemptCount: 1,
      averagePercentage: 90,
      bestPercentage: 90,
      latestPercentage: 90,
      averageDurationLabel: "12 min",
      lowConfidence: true,
    });
  });
});
