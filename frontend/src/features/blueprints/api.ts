import { apiFetch } from "@/lib/api/browser";

export type BlueprintSectionDraft = {
  id: string;
  title: string;
  question_type: string;
  question_count: number;
  duration_minutes: number;
  points: number;
  skills: string[];
  confidence: number;
  source_refs: string[];
};

export type BlueprintRulesDraft = {
  duration_minutes: number | null;
  total_points: number | null;
  pass_percentage: number | null;
  penalty: string;
  allowed_materials: string;
  grading_notes: string;
  source_refs: string[];
};

export type BlueprintContent = {
  sections: BlueprintSectionDraft[];
  rules: BlueprintRulesDraft;
  skill_taxonomy: Array<{ id: string; label: string }>;
  unresolved_fields: Array<{ path: string; reason: string }>;
  overall_confidence: number;
  evidence?: Array<{
    chunk_id: string;
    artifact_id: string;
    artifact_name: string;
    artifact_kind: string;
    page_number: number | null;
    excerpt: string;
  }>;
};

export type BlueprintDto = {
  id: string;
  exam_id: string;
  version: number;
  status: "extracting" | "draft" | "approved" | "failed" | "stale";
  content: BlueprintContent;
  source_artifact_ids: string[];
  provider: string;
  model: string;
  prompt_version: string;
  schema_version: string;
  overall_confidence: number;
  validation_errors: Array<{ path?: string; message?: string }>;
  error_code: string | null;
  error_message: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export const getCurrentBlueprint = (examId: string) =>
  apiFetch<BlueprintDto>(`/exams/${examId}/blueprints/current`);

export const extractBlueprint = (examId: string) =>
  apiFetch<BlueprintDto>(`/exams/${examId}/blueprints/extractions`, {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({ artifact_ids: null }),
  });

export const updateBlueprintDraft = (
  blueprintId: string,
  content: BlueprintContent,
) =>
  apiFetch<BlueprintDto>(`/blueprints/${blueprintId}`, {
    method: "PATCH",
    body: JSON.stringify({ content }),
  });

export const approveBlueprint = (blueprintId: string) =>
  apiFetch<BlueprintDto>(`/blueprints/${blueprintId}/approve`, {
    method: "POST",
  });

export const retryBlueprint = (blueprintId: string) =>
  apiFetch<BlueprintDto>(`/blueprints/${blueprintId}/retry`, {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });
