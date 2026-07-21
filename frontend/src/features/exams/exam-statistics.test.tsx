import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/browser";
import { useDemo } from "@/features/demo/demo-provider";
import { getExamAnalytics } from "@/features/analytics/api";
import type { ExamAnalytics } from "@/features/analytics/types";

import type { AttemptSummaryDto, ExamStatisticsDto } from "./api";
import { getExamStatistics, listExamAttempts } from "./api";
import { ExamStatistics } from "./exam-statistics";

vi.mock("@/features/demo/demo-provider", () => ({ useDemo: vi.fn() }));
vi.mock("@/features/analytics/api", () => ({ getExamAnalytics: vi.fn() }));
vi.mock("./api", () => ({
  getExamStatistics: vi.fn(),
  listExamAttempts: vi.fn(),
}));

const getStatisticsMock = vi.mocked(getExamStatistics);
const listAttemptsMock = vi.mocked(listExamAttempts);
const getAnalyticsMock = vi.mocked(getExamAnalytics);

const emptyAnalytics: ExamAnalytics = {
  model_version: "analytics.v1",
  computed_at: "2026-07-21T10:00:00Z",
  exam_id: "exam-1",
  exam_title: "Exam",
  attempt_ids: [],
  constants: { recency_half_life_days: 30, coverage_scale: 3, readiness_uncertainty_penalty: 15 },
  readiness: { index: null, raw_mastery: null, confidence: 0, coverage: 0, status: "no_data", pass_threshold: 50, explanation: "Complete a mock to create the first readiness signal." },
  skills: [{ skill_id: "core", label: "Core knowledge", blueprint_weight: 1, mastery: null, confidence: 0, confidence_level: "low_evidence", evidence_count: 0, effective_evidence: 0, attempt_count: 0, trend: "insufficient_data", trend_delta: null, latest_observed_at: null }],
  trajectory: [],
  recommendations: [{ exam_id: "exam-1", action: "run_full_mock", title: "Complete a diagnostic mock", reason: "No evidence yet.", target_skill_ids: [], confidence: 0, priority: 1 }],
  adaptive: { eligible: false, target_skill_ids: [], reason: "Complete a diagnostic mock first.", confidence_level: "low_evidence", recommended_difficulty: "matched" },
};

const zeroStatistics: ExamStatisticsDto = {
  exam_id: "exam-1",
  attempt_count: 0,
  average_percentage: null,
  best_percentage: null,
  latest_percentage: null,
  average_duration_seconds: null,
  low_confidence: true,
};

function attempt(id: string, percentage: number): AttemptSummaryDto {
  return {
    attempt_id: id,
    exam_id: "exam-1",
    status: "evaluated",
    score: percentage,
    max_score: 100,
    percentage,
    passed: percentage >= 50,
    duration_seconds: 600,
    submitted_at: `2026-07-${id === "one" ? "16" : "15"}T10:00:00Z`,
    feedback: "",
  };
}

function mockNormalResponse(statistics = zeroStatistics, attempts: AttemptSummaryDto[] = []) {
  getStatisticsMock.mockResolvedValue(statistics);
  listAttemptsMock.mockResolvedValue(attempts);
  getAnalyticsMock.mockResolvedValue(emptyAnalytics);
}

afterEach(() => {
  delete process.env.NEXT_PUBLIC_DEMO_MODE;
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useDemo).mockReturnValue({ exams: [], loading: false } as never);
  getAnalyticsMock.mockResolvedValue(emptyAnalytics);
});

describe("ExamStatistics", () => {
  it("shows a loading skeleton while normal-mode requests are pending", () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    getStatisticsMock.mockReturnValue(new Promise(() => {}));
    listAttemptsMock.mockReturnValue(new Promise(() => {}));

    render(<ExamStatistics examId="exam-1" />);

    expect(screen.getByRole("status", { name: "Loading statistics" })).toBeInTheDocument();
  });

  it("renders zero attempts as an intentional empty state", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    mockNormalResponse();

    render(<ExamStatistics examId="exam-1" />);

    expect(await screen.findByText("No results yet")).toBeInTheDocument();
    expect(screen.getByText("Completed attempts").parentElement?.parentElement).toHaveTextContent("0");
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(4);
  });

  it("labels a single attempt as sparse data", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    mockNormalResponse(
      { ...zeroStatistics, attempt_count: 1, average_percentage: 74, best_percentage: 74, latest_percentage: 74, average_duration_seconds: 600 },
      [attempt("one", 74)],
    );

    render(<ExamStatistics examId="exam-1" />);

    expect(await screen.findByText("Single attempt — early signal only")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Scores per attempt, oldest first" })).toHaveTextContent("74%");
  });

  it("renders multiple API attempts and visible percentage labels", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    mockNormalResponse(
      { ...zeroStatistics, attempt_count: 2, average_percentage: 75, best_percentage: 80, latest_percentage: 70, average_duration_seconds: 630 },
      [attempt("one", 70), attempt("two", 80)],
    );

    render(<ExamStatistics examId="exam-1" />);

    expect(await screen.findByText("2 completed attempts")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View attempt history/ })).toHaveAttribute("href", "/exams/exam-1?tab=history");
    expect(screen.getByRole("list", { name: "Scores per attempt, oldest first" })).toHaveTextContent(/80%.*70%/);
  });

  it("offers a working retry for recoverable request failures", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    getStatisticsMock.mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce(zeroStatistics);
    listAttemptsMock.mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce([]);

    render(<ExamStatistics examId="exam-1" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Offline");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No results yet")).toBeInTheDocument();
    expect(getStatisticsMock).toHaveBeenCalledTimes(2);
  });

  it("treats not-found and permission errors as non-retryable unavailable states", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    getStatisticsMock.mockRejectedValue(new ApiError("Exam not found", 404));
    listAttemptsMock.mockResolvedValue([]);

    render(<ExamStatistics examId="exam-1" />);

    expect(await screen.findByText("Statistics unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("uses demo attempts without any network calls in demo mode", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "true";
    vi.mocked(useDemo).mockReturnValue({
      loading: false,
      exams: [
        {
          id: "exam-1",
          title: "Demo exam",
          attempts: [
            { id: "demo-attempt", score: 8, maxScore: 10, durationMinutes: 9, completedAt: "today" },
          ],
        },
      ],
    } as never);

    render(<ExamStatistics examId="exam-1" />);

    expect(await screen.findByText("Single attempt — early signal only")).toBeInTheDocument();
    expect(getStatisticsMock).not.toHaveBeenCalled();
    expect(listAttemptsMock).not.toHaveBeenCalled();
    expect(getAnalyticsMock).not.toHaveBeenCalled();
  });
});
