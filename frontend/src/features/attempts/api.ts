import { apiFetch } from "@/lib/api/browser";

export type MockDto = {
  id: string;
  duration_minutes: number;
  max_score: number;
  questions: Array<{
    id: string;
    section_id: string;
    position: number;
    prompt: string;
    points: number;
    question_type: string;
    topic?: string | null;
    citations?: Array<{ chunk_id: string; artifact_id?: string; page_number?: number | null }>;
  }>;
};
export type AttemptDto = {
  id: string;
  mock_exam: MockDto;
  status: "in_progress" | "evaluated";
  started_at: string;
  responses: Array<{ question_id: string; answer: string; flagged: boolean; version: number }>;
};
export type ResultDto = { score: number; max_score: number; percentage: number; duration_seconds: number; submitted_at: string; feedback: string };

export const getAttempt = (id: string) => apiFetch<AttemptDto>(`/attempts/${id}`);
export const generateMock = (examId: string) => apiFetch<MockDto>(`/exams/${examId}/mocks`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() } });
export const startAttempt = (mockId: string) => apiFetch<AttemptDto>(`/mocks/${mockId}/attempts`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() } });
export const saveAttemptResponse = (attemptId: string, questionId: string, answer: string, flagged: boolean) => apiFetch(`/attempts/${attemptId}/responses/${questionId}`, { method: "PUT", body: JSON.stringify({ answer, flagged }) });
export const submitAttempt = (attemptId: string) => apiFetch<ResultDto>(`/attempts/${attemptId}/submit`, { method: "POST", headers: { "Idempotency-Key": attemptId } });
