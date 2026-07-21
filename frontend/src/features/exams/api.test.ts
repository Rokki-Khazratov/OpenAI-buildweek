import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "@/lib/api/browser";

import { createExam, updateExam } from "./api";
import type { ExamInput } from "./types";

vi.mock("@/lib/api/browser", () => ({ apiFetch: vi.fn() }));

const input: ExamInput = {
  subjectId: "subject-1",
  title: "Untitled exam",
  description: "",
  examType: "",
  language: "en",
  targetDate: "",
  status: "draft",
  pastedContext: "",
  sources: [],
  blueprint: [],
  rules: {
    durationMinutes: 60,
    totalPoints: 100,
    passPercentage: 50,
    penalty: "",
    allowedMaterials: "",
    gradingNotes: "",
  },
  scenario: {
    mode: "full_exam",
    difficulty: "matched",
    instructions: "",
  },
};

describe("exam draft API payloads", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockResolvedValue({} as never);
  });

  it("persists an explicit draft when creating an exam", async () => {
    await createExam(input);

    expect(apiFetch).toHaveBeenCalledWith(
      "/subjects/subject-1/exams",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"status":"draft"'),
      }),
    );
  });

  it("keeps optimistic concurrency when updating a draft", async () => {
    await updateExam("exam-1", input, 7);

    const request = vi.mocked(apiFetch).mock.calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toMatchObject({
      status: "draft",
      configuration_version: 7,
    });
  });
});
