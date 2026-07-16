import type { SourceKind } from "@/features/exams/types";

export type ArtifactStatus =
  | "pending"
  | "queued"
  | "processing"
  | "ready"
  | "failed"
  | "deleting";

export type Artifact = {
  id: string;
  exam_id: string;
  kind: SourceKind;
  original_name: string;
  declared_media_type: string;
  detected_media_type: string | null;
  size_bytes: number;
  upload_status: "pending" | "uploaded" | "cancelled";
  processing_status: ArtifactStatus;
  failure_code: string | null;
  failure_message: string | null;
  parser_version: string | null;
  page_count: number | null;
  character_count: number | null;
  uploaded_at: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ArtifactList = { items: Artifact[]; total: number };

export type UploadSession = {
  artifact: Artifact;
  upload: {
    method: "PUT";
    url: string;
    headers: Record<string, string>;
    expires_at: string;
  };
};
