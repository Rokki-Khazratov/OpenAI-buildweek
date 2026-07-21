import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clonePublication, listPublications, type LibraryPublication } from "./api";
import { LibraryWorkspace } from "./library-workspace";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/features/demo/demo-provider", () => ({ useDemo: () => ({ reload: vi.fn() }) }));
vi.mock("./api", () => ({ listPublications: vi.fn(), clonePublication: vi.fn() }));

const publication: LibraryPublication = {
  id: "publication-1",
  source_exam_id: null,
  title: "Algorithms final",
  description: "Verified contract",
  subject_title: "Algorithms",
  university: "TU Wien",
  course_code: "CS-301",
  exam_type: "Written final",
  language: "en",
  blueprint: {
    sections: [{ id: "core", title: "Core", question_type: "open", question_count: 2, duration_minutes: 30, points: 20, skills: ["reasoning"], confidence: 0.9 }],
    skill_taxonomy: [{ id: "reasoning", label: "Reasoning" }],
    overall_confidence: 0.9,
  },
  rules: {},
  scenario: {},
  source_configuration_version: 2,
  blueprint_version: 3,
  rights_note: "Study use.",
  publisher_name: "Ada",
  clone_count: 4,
  is_published: true,
  published_at: "2026-07-20T10:00:00Z",
};

beforeEach(() => {
  process.env.NEXT_PUBLIC_DEMO_MODE = "false";
  vi.useFakeTimers();
  vi.mocked(listPublications).mockResolvedValue({ items: [publication], total: 1 });
  vi.mocked(clonePublication).mockResolvedValue({ publication_id: publication.id, subject_id: "subject-copy", exam_id: "exam-copy", already_cloned: false });
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_DEMO_MODE;
  vi.useRealTimers();
});

describe("LibraryWorkspace", () => {
  it("discovers, previews, and clones a safe Exam contract", async () => {
    render(<LibraryWorkspace />);
    await act(async () => { await vi.advanceTimersByTimeAsync(220); });

    expect(screen.getByText("Algorithms final")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Algorithms final"));
    expect(screen.getByText("By Ada")).toBeInTheDocument();
    expect(screen.getByText(/No source files or student data/)).toBeInTheDocument();

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Clone private copy" })); });
    expect(clonePublication).toHaveBeenCalledWith("publication-1");
    expect(push).toHaveBeenCalledWith("/subjects/subject-copy");
  });

  it("sends search and filter values to discovery", async () => {
    render(<LibraryWorkspace />);
    await act(async () => { await vi.advanceTimersByTimeAsync(220); });
    fireEvent.change(screen.getByLabelText("Search Library"), { target: { value: "quantum" } });
    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "de" } });
    fireEvent.change(screen.getByLabelText("Exam type"), { target: { value: "Oral" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(220); });
    expect(listPublications).toHaveBeenLastCalledWith({ query: "quantum", language: "de", examType: "Oral" });
  });
});
