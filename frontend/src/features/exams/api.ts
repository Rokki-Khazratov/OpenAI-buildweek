import type { Exam, ExamInput } from "./types";
import { apiFetch } from "@/lib/api/browser";
import type { ListPage } from "@/lib/api/types";

export type ExamDto = { id: string; subject_id: string; title: string; description: string | null; exam_type: string | null; language: string; target_date: string | null; status: Exam["status"]; pasted_context: string; sources: Exam["sources"]; blueprint: Exam["blueprint"]; rules: Exam["rules"]; scenario: Exam["scenario"]; configuration_version: number; updated_at: string };
export type AttemptSummaryDto = { attempt_id: string; exam_id: string; status: string; score: number; max_score: number; percentage: number; passed: boolean; duration_seconds: number; submitted_at: string; feedback: string };
export type ExamStatisticsDto = { exam_id: string; attempt_count: number; average_percentage: number | null; best_percentage: number | null; latest_percentage: number | null; average_duration_seconds: number | null; low_confidence: boolean };

const payload = (input: ExamInput) => ({ title: input.title, description: input.description || null, exam_type: input.examType || null, language: input.language, target_date: input.targetDate || null, status: input.status, pasted_context: input.pastedContext, sources: [], blueprint: input.blueprint, rules: input.rules, scenario: input.scenario });
export const listExams = (subjectId: string) => apiFetch<ListPage<ExamDto>>(`/subjects/${subjectId}/exams?limit=100`);
export const createExam = (input: ExamInput) => apiFetch<ExamDto>(`/subjects/${input.subjectId}/exams`, { method: "POST", body: JSON.stringify(payload(input)) });
export const updateExam = (id: string, input: ExamInput, configurationVersion?: number) => apiFetch<ExamDto>(`/exams/${id}`, { method: "PATCH", body: JSON.stringify({ ...payload(input), configuration_version: configurationVersion }) });
export const deleteExam = (id: string) => apiFetch<void>(`/exams/${id}`, { method: "DELETE" });
export const listExamAttempts = (id: string) => apiFetch<AttemptSummaryDto[]>(`/exams/${id}/attempts`);
export const getExamStatistics = (id: string) => apiFetch<ExamStatisticsDto>(`/exams/${id}/statistics`);
