import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDemo } from "@/features/demo/demo-provider";
import type { Exam } from "@/features/exams/types";

import { AnalyticsOverviewScreen } from "./analytics-overview";
import { getAnalyticsOverview } from "./api";
import { demoExamAnalytics } from "./demo";
import { ExamAnalyticsPanel } from "./exam-analytics-panel";

vi.mock("@/features/demo/demo-provider", () => ({ useDemo: vi.fn() }));
vi.mock("./api", () => ({ getAnalyticsOverview: vi.fn() }));

const getOverviewMock = vi.mocked(getAnalyticsOverview);

const algorithmsExam: Exam = {
  id: "algorithms-final",
  subjectId: "algorithms",
  title: "Algorithms final",
  description: "Adaptive analytics fixture",
  examType: "Written final",
  language: "en",
  targetDate: "2026-09-04",
  status: "ready",
  pastedContext: "",
  configurationVersion: 1,
  sources: [],
  blueprint: [
    { id: "analysis", title: "Analysis", questionType: "Proof", questionCount: 3, durationMinutes: 30, points: 30 },
    { id: "design", title: "Design", questionType: "Design", questionCount: 3, durationMinutes: 50, points: 50 },
    { id: "complexity", title: "Complexity", questionType: "Short answer", questionCount: 4, durationMinutes: 40, points: 20 },
  ],
  rules: { durationMinutes: 120, totalPoints: 100, passPercentage: 50, penalty: "None", allowedMaterials: "None", gradingNotes: "Show work" },
  scenario: { mode: "adaptive", difficulty: "matched", instructions: "Target weak skills" },
  attempts: [
    { id: "attempt-3", examId: "algorithms-final", score: 70, maxScore: 100, durationMinutes: 111, completedAt: "20 July", feedback: "", answers: {} },
    { id: "attempt-2", examId: "algorithms-final", score: 61, maxScore: 100, durationMinutes: 118, completedAt: "17 July", feedback: "", answers: {} },
    { id: "attempt-1", examId: "algorithms-final", score: 52, maxScore: 100, durationMinutes: 120, completedAt: "14 July", feedback: "", answers: {} },
  ],
  updatedAt: "Today",
};

afterEach(() => {
  delete process.env.NEXT_PUBLIC_DEMO_MODE;
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useDemo).mockReturnValue({ exams: [], loading: false } as never);
});

describe("personal analytics", () => {
  it("keeps mastery, confidence, and opposite skill trends distinct", () => {
    const profile = demoExamAnalytics(algorithmsExam);
    const dynamicProgramming = profile.skills.find((skill) => skill.skill_id === "dynamic-programming");
    const graphAlgorithms = profile.skills.find((skill) => skill.skill_id === "graph-algorithms");
    const complexity = profile.skills.find((skill) => skill.skill_id === "complexity");
    const recursion = profile.skills.find((skill) => skill.skill_id === "recursion");

    expect(profile.skills).toHaveLength(4);
    expect(dynamicProgramming?.trend).toBe("improving");
    expect(graphAlgorithms?.trend).toBe("declining");
    expect(complexity?.confidence_level).toBe("established");
    expect(recursion?.confidence_level).toBe("low_evidence");
    expect(profile.trajectory.map((point) => point.score_percentage)).toEqual([52, 61, 70]);
    expect(profile.trajectory[2].readiness_index).toBeGreaterThan(profile.trajectory[0].readiness_index ?? 0);
    expect(profile.adaptive.target_skill_ids).toContain("dynamic-programming");
  });

  it("renders evidence labels and an adaptive action per exam", () => {
    render(<ExamAnalyticsPanel profile={demoExamAnalytics(algorithmsExam)} />);

    expect(screen.getByText("Dynamic programming")).toBeInTheDocument();
    expect(screen.getByText("Graph algorithms")).toBeInTheDocument();
    expect(screen.getByText("improving")).toBeInTheDocument();
    expect(screen.getByText("declining")).toBeInTheDocument();
    expect(screen.getByText("low evidence")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Run adaptive mock/ })).toHaveAttribute(
      "href",
      "/exams/algorithms-final/run?mode=adaptive",
    );
  });

  it("shows loading and recoverable error states for the live API", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    getOverviewMock.mockReturnValueOnce(new Promise(() => {}));
    const { unmount } = render(<AnalyticsOverviewScreen view="analytics" />);
    expect(screen.getByRole("status", { name: "Loading analytics" })).toBeInTheDocument();
    unmount();

    getOverviewMock.mockRejectedValueOnce(new Error("Analytics offline"));
    render(<AnalyticsOverviewScreen view="analytics" />);
    expect(await screen.findByText("Analytics is unavailable")).toBeInTheDocument();
    expect(screen.getByText("Analytics offline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("renders an intentional empty state in demo mode", () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "true";
    render(<AnalyticsOverviewScreen view="statistics" />);
    expect(screen.getByText("No exams to analyse")).toBeInTheDocument();
    expect(getOverviewMock).not.toHaveBeenCalled();
  });
});
