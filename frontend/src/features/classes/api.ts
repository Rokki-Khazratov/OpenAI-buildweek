import type { StudyClass, StudyClassInput } from "./types";
import { apiFetch } from "@/lib/api/browser";
import type { ListPage } from "@/lib/api/types";

export type ClassDto = {
  id: string;
  subject_id: string;
  name: string;
  description: string | null;
  exam_scope: "subject" | "selected_exams";
  exam_ids: string[];
  created_at: string;
  updated_at: string;
};

const payload = (input: StudyClassInput) => ({ name: input.name, description: input.description || null, exam_scope: input.examScope === "selected" ? "selected_exams" : "subject", exam_ids: input.examScope === "selected" ? input.examIds : [] });
export const listClasses = (subjectId: string) => apiFetch<ListPage<ClassDto>>(`/subjects/${subjectId}/classes?limit=100`);
export const createClass = (input: StudyClassInput) => apiFetch<ClassDto>(`/subjects/${input.subjectId}/classes`, { method: "POST", body: JSON.stringify(payload(input)) });
export const updateClass = (id: string, input: StudyClassInput) => apiFetch<ClassDto>(`/classes/${id}`, { method: "PATCH", body: JSON.stringify(payload(input)) });
export const deleteClass = (id: string) => apiFetch<void>(`/classes/${id}`, { method: "DELETE" });

export type { StudyClass };
