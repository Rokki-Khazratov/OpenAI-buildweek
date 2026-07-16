import { apiFetch } from "@/lib/api/browser";

import type { Artifact, ArtifactList, ArtifactSummary, UploadSession } from "./types";
import type { SourceKind } from "@/features/exams/types";

const mediaTypes: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};

const maxArtifactBytes = 25 * 1024 * 1024;

export function validateArtifactFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!(extension in mediaTypes)) return `${file.name}: only PDF, DOCX, and TXT are supported.`;
  if (file.size === 0) return `${file.name}: empty files cannot be uploaded.`;
  if (file.size > maxArtifactBytes) return `${file.name}: the maximum file size is 25 MiB.`;
  return null;
}

export function artifactMediaType(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return mediaTypes[extension] ?? file.type;
}

export function listArtifacts(examId: string) {
  return apiFetch<ArtifactList>(`/exams/${examId}/artifacts`);
}

export async function uploadArtifact(
  examId: string,
  file: File,
  kind: SourceKind,
  onProgress?: (percent: number) => void,
) {
  const validationError = validateArtifactFile(file);
  if (validationError) throw new Error(validationError);
  const mediaType = artifactMediaType(file);
  const session = await apiFetch<UploadSession>(`/exams/${examId}/artifacts/uploads`, {
    method: "POST",
    body: JSON.stringify({
      filename: file.name,
      kind,
      media_type: mediaType,
      size_bytes: file.size,
    }),
  });
  await putFile(session.upload.url, file, session.upload.headers, onProgress);
  return apiFetch<Artifact>(`/artifacts/${session.artifact.id}/complete`, { method: "POST" });
}

function putFile(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress?: (percent: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    Object.entries(headers).forEach(([name, value]) => request.setRequestHeader(name, value));
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new Error("The file could not reach storage. Check your connection and retry."));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error(`Storage rejected the upload (${request.status}).`));
    };
    request.send(file);
  });
}

export function retryArtifact(id: string) {
  return apiFetch<Artifact>(`/artifacts/${id}/retry`, { method: "POST" });
}

export function getArtifactSummary(id: string) {
  return apiFetch<ArtifactSummary>(`/artifacts/${id}/content-summary`);
}

export function deleteArtifact(id: string) {
  return apiFetch<void>(`/artifacts/${id}`, { method: "DELETE" });
}

export async function downloadArtifact(id: string) {
  const response = await apiFetch<{ url: string }>(`/artifacts/${id}/download`);
  window.open(response.url, "_blank", "noopener,noreferrer");
}
