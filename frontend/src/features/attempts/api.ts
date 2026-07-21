import { apiFetch } from "@/lib/api/browser";

export type MockDto = {
  id: string;
  generator: string;
  generation_metadata: Record<string, unknown>;
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
    skill_ids: string[];
    difficulty: string;
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
export type ResultDto = {
  attempt_id: string;
  exam_id: string;
  score: number;
  max_score: number;
  percentage: number;
  passed: boolean;
  duration_seconds: number;
  submitted_at: string;
  feedback: string;
  evaluator: string;
  section_results: Array<{
    section_id: string;
    awarded_points: number;
    max_points: number;
    percentage: number;
  }>;
  question_results: Array<{
    question_id: string;
    section_id: string;
    question_number: number;
    prompt: string;
    question_type: string;
    skill_ids: string[];
    awarded_points: number;
    max_points: number;
    normalized_score: number;
    strategy: string;
    feedback: { strength?: string; improvement?: string; next_step?: string };
    dimension_scores: Array<{
      dimension_id: string;
      awarded_points: number;
      max_points: number;
      reason: string;
      answer_evidence: string[];
    }>;
    source_evidence: Array<{
      chunk_id: string;
      quote: string;
      artifact_name?: string | null;
      page_number?: number | null;
    }>;
    confidence: number;
    flags: string[];
  }>;
};

export const getAttempt = (id: string) => apiFetch<AttemptDto>(`/attempts/${id}`);
export const getAttemptResult = (id: string) => apiFetch<ResultDto>(`/attempts/${id}/result`);
export const generateMock = (
  examId: string,
  mode: "full_exam" | "adaptive" = "full_exam",
) => apiFetch<MockDto>(`/exams/${examId}/mocks`, {
  method: "POST",
  headers: { "Idempotency-Key": crypto.randomUUID() },
  body: JSON.stringify({ mode }),
});
export const startAttempt = (mockId: string) => apiFetch<AttemptDto>(`/mocks/${mockId}/attempts`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() } });
export const saveAttemptResponse = (attemptId: string, questionId: string, answer: string, flagged: boolean) => apiFetch(`/attempts/${attemptId}/responses/${questionId}`, { method: "PUT", body: JSON.stringify({ answer, flagged }) });
export const submitAttempt = (attemptId: string) => apiFetch<ResultDto>(`/attempts/${attemptId}/submit`, { method: "POST", headers: { "Idempotency-Key": attemptId } });
