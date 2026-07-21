import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addClassMember,
  getClassDashboard,
  listClassMembers,
  removeClassMember,
  type ClassDashboardDto,
} from "./api";
import { ClassDashboard } from "./class-dashboard";

vi.mock("./api", () => ({
  addClassMember: vi.fn(),
  getClassDashboard: vi.fn(),
  listClassMembers: vi.fn(),
  removeClassMember: vi.fn(),
}));

const metrics: ClassDashboardDto = {
  class_id: "class-1",
  exam_id: null,
  model_version: "analytics.v2",
  privacy_threshold: 3,
  suppressed: false,
  suppression_reason: null,
  member_count: 3,
  active_learners: 3,
  eligible_learners: 3,
  total_attempts: 3,
  median_readiness_index: 60,
  readiness_coverage: 1,
  readiness_confidence_distribution: { low_evidence: 2, developing: 1, established: 0 },
  low_evidence_percentage: 66.7,
  weak_skills: [{ skill_id: "reasoning", label: "Reasoning", mastery_percentage: 60, confidence: 0.4, support: 3, evidence_count: 6, signal: "confirmed_gap" }],
  recommended_action: "Review Reasoning with the whole class.",
};

const studyClass = { id: "class-1", subjectId: "subject-1", name: "Cohort", description: "", examScope: "subject" as const, examIds: [], memberCount: 2, createdAt: "today", updatedAt: "today" };

beforeEach(() => {
  process.env.NEXT_PUBLIC_DEMO_MODE = "false";
  vi.mocked(getClassDashboard).mockResolvedValue(metrics);
  vi.mocked(listClassMembers).mockResolvedValue([
    { user_id: "owner", display_name: "Ada", role: "owner", leaderboard_opt_in: false, joined_at: "2026-07-19T10:00:00Z" },
    { user_id: "learner", display_name: "Lin", role: "member", leaderboard_opt_in: false, joined_at: "2026-07-19T10:00:00Z" },
  ]);
});

afterEach(() => { delete process.env.NEXT_PUBLIC_DEMO_MODE; });

describe("ClassDashboard", () => {
  it("renders reconciled aggregates without raw learner evidence", async () => {
    render(<ClassDashboard studyClass={studyClass} exams={[]} />);
    expect(await screen.findByText("Evidence confidence")).toBeInTheDocument();
    expect(screen.getAllByText("60%")).not.toHaveLength(0);
    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(screen.getAllByText("Reasoning")).not.toHaveLength(0);
    expect(document.body).not.toHaveTextContent("Participant readiness");
    expect(document.body).not.toHaveTextContent("answer evidence");
    expect(document.body).not.toHaveTextContent("private feedback");
  });

  it("adds an existing account and refreshes dashboard metrics", async () => {
    vi.mocked(addClassMember).mockResolvedValue({ user_id: "new", display_name: "Mia", role: "member", leaderboard_opt_in: false, joined_at: "2026-07-20T10:00:00Z" });
    render(<ClassDashboard studyClass={studyClass} exams={[]} />);
    await screen.findByText("Class membership");
    fireEvent.change(screen.getByPlaceholderText("student@example.com"), { target: { value: "mia@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Add participant" }));
    expect(await screen.findByText("Mia")).toBeInTheDocument();
    expect(addClassMember).toHaveBeenCalledWith("class-1", "mia@example.com");
    expect(getClassDashboard).toHaveBeenCalledTimes(2);
    expect(removeClassMember).not.toHaveBeenCalled();
  });
});
