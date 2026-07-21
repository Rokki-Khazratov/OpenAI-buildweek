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
  member_count: 2,
  active_learners: 2,
  total_attempts: 2,
  average_percentage: 60,
  readiness_percentage: 60,
  readiness_coverage: 1,
  pass_rate: 50,
  weak_skills: [{ skill_id: "reasoning", percentage: 60, support: 2 }],
  participants: [
    { user_id: "owner", display_name: "Ada", role: "owner", attempts: 1, average_percentage: 80, readiness_percentage: 80, last_activity_at: "2026-07-20T10:00:00Z", weak_skill_ids: [] },
    { user_id: "learner", display_name: "Lin", role: "member", attempts: 1, average_percentage: 40, readiness_percentage: 40, last_activity_at: "2026-07-20T09:00:00Z", weak_skill_ids: ["reasoning"] },
  ],
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
    expect(await screen.findByText("Participant readiness")).toBeInTheDocument();
    expect(screen.getAllByText("60%")).not.toHaveLength(0);
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getAllByText("reasoning")).not.toHaveLength(0);
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
