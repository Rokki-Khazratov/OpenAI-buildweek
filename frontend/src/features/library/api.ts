import { apiFetch } from "@/lib/api/browser";
import type { ListPage } from "@/lib/api/types";

export type PublishedSection = {
  id: string;
  title: string;
  question_type: string;
  question_count: number;
  duration_minutes: number;
  points: number;
  skills: string[];
  confidence: number;
};

export type LibraryPublication = {
  id: string;
  source_exam_id: string | null;
  title: string;
  description: string | null;
  subject_title: string;
  university: string | null;
  course_code: string | null;
  exam_type: string | null;
  language: string;
  blueprint: {
    sections: PublishedSection[];
    skill_taxonomy: Array<{ id: string; label: string }>;
    overall_confidence: number;
  };
  rules: Record<string, unknown>;
  scenario: Record<string, unknown>;
  source_configuration_version: number;
  blueprint_version: number;
  rights_note: string;
  publisher_name: string;
  clone_count: number;
  is_published: boolean;
  published_at: string;
};

export type LibraryClone = {
  publication_id: string;
  subject_id: string;
  exam_id: string;
  already_cloned: boolean;
};

export function listPublications(filters: {
  query?: string;
  language?: string;
  examType?: string;
}) {
  const search = new URLSearchParams({ limit: "100" });
  if (filters.query) search.set("query", filters.query);
  if (filters.language) search.set("language", filters.language);
  if (filters.examType) search.set("exam_type", filters.examType);
  return apiFetch<ListPage<LibraryPublication>>(
    `/library/publications?${search.toString()}`,
  );
}

export const getExamPublication = (examId: string) =>
  apiFetch<LibraryPublication>(`/exams/${examId}/publication`);

export const publishExam = (examId: string, rightsNote: string) =>
  apiFetch<LibraryPublication>(`/exams/${examId}/publication`, {
    method: "PUT",
    body: JSON.stringify({ rights_note: rightsNote }),
  });

export const unpublishExam = (examId: string) =>
  apiFetch<void>(`/exams/${examId}/publication`, { method: "DELETE" });

export const clonePublication = (publicationId: string) =>
  apiFetch<LibraryClone>(`/library/publications/${publicationId}/clone`, {
    method: "POST",
  });

