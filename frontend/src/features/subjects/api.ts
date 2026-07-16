import type { Subject, SubjectInput } from "./types";
import { apiFetch } from "@/lib/api/browser";
import type { ListPage } from "@/lib/api/types";

export type SubjectDto = {
  id: string;
  title: string;
  university: string | null;
  course_code: string | null;
  visibility: Subject["visibility"];
  updated_at: string;
};

export const listSubjects = () => apiFetch<ListPage<SubjectDto>>("/subjects?limit=100");
export const createSubject = (input: SubjectInput) => apiFetch<SubjectDto>("/subjects", { method: "POST", body: JSON.stringify({ title: input.title, university: input.university || null, course_code: input.courseCode || null, visibility: input.visibility }) });
export const updateSubject = (id: string, input: SubjectInput) => apiFetch<SubjectDto>(`/subjects/${id}`, { method: "PATCH", body: JSON.stringify({ title: input.title, university: input.university || null, course_code: input.courseCode || null, visibility: input.visibility }) });
export const deleteSubject = (id: string) => apiFetch<void>(`/subjects/${id}`, { method: "DELETE" });
