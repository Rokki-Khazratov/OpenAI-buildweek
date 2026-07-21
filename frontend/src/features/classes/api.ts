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
  member_count: number;
  created_at: string;
  updated_at: string;
};

const payload = (input: StudyClassInput) => ({ name: input.name, description: input.description || null, exam_scope: input.examScope === "selected" ? "selected_exams" : "subject", exam_ids: input.examScope === "selected" ? input.examIds : [] });
export const listClasses = (subjectId: string) => apiFetch<ListPage<ClassDto>>(`/subjects/${subjectId}/classes?limit=100`);
export const createClass = (input: StudyClassInput) => apiFetch<ClassDto>(`/subjects/${input.subjectId}/classes`, { method: "POST", body: JSON.stringify(payload(input)) });
export const updateClass = (id: string, input: StudyClassInput) => apiFetch<ClassDto>(`/classes/${id}`, { method: "PATCH", body: JSON.stringify(payload(input)) });
export const deleteClass = (id: string) => apiFetch<void>(`/classes/${id}`, { method: "DELETE" });

export type ClassMemberDto = {
  user_id: string;
  display_name: string;
  role: "owner" | "member";
  leaderboard_opt_in: boolean;
  joined_at: string;
};

export type ClassDashboardDto = {
  class_id: string;
  exam_id: string | null;
  member_count: number;
  active_learners: number;
  total_attempts: number;
  average_percentage: number | null;
  readiness_percentage: number | null;
  readiness_coverage: number;
  pass_rate: number | null;
  weak_skills: Array<{ skill_id: string; percentage: number; support: number }>;
  participants: Array<{
    user_id: string;
    display_name: string;
    role: "owner" | "member";
    attempts: number;
    average_percentage: number | null;
    readiness_percentage: number | null;
    last_activity_at: string | null;
    weak_skill_ids: string[];
  }>;
};

export const listClassMembers = (id: string) =>
  apiFetch<ClassMemberDto[]>(`/classes/${id}/members`);
export const addClassMember = (id: string, email: string) =>
  apiFetch<ClassMemberDto>(`/classes/${id}/members`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
export const removeClassMember = (id: string, userId: string) =>
  apiFetch<void>(`/classes/${id}/members/${userId}`, { method: "DELETE" });
export const getClassDashboard = (id: string, examId?: string) =>
  apiFetch<ClassDashboardDto>(
    `/classes/${id}/dashboard${examId ? `?exam_id=${examId}` : ""}`,
  );

export type { StudyClass };
