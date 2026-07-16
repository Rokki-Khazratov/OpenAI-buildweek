"use client";

import {
  Download,
  FileText,
  Info,
  LoaderCircle,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";

import { StatusPill } from "@/components/ui/status-pill";
import type { SourceKind } from "@/features/exams/types";

import {
  deleteArtifact,
  downloadArtifact,
  getArtifactSummary,
  listArtifacts,
  retryArtifact,
  uploadArtifact,
  validateArtifactFile,
} from "./api";
import type { Artifact, ArtifactSummary } from "./types";

const processingLabels: Record<Artifact["processing_status"], string> = {
  not_queued: "waiting",
  queued: "queued",
  processing: "processing",
  ready: "ready",
  failed: "failed",
  deleting: "deleting",
};

function sizeLabel(bytes: number) {
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1000))} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function isStuckQueued(item: Artifact) {
  return (
    item.processing_status === "queued" &&
    Date.now() - new Date(item.updated_at).getTime() > 30_000
  );
}

function statusView(item: Artifact) {
  if (item.upload_status === "pending") {
    return {
      label: "upload interrupted",
      tone: "warning" as const,
      help: "The browser no longer has this file. Delete it and choose the file again.",
    };
  }
  if (item.upload_status === "expired" || item.upload_status === "cancelled") {
    return {
      label: item.upload_status,
      tone: "danger" as const,
      help: "This upload session is no longer active.",
    };
  }
  return {
    label: processingLabels[item.processing_status],
    tone:
      item.processing_status === "ready"
        ? ("success" as const)
        : item.processing_status === "failed"
          ? ("danger" as const)
          : ("warning" as const),
    help:
      item.failure_message ??
      (isStuckQueued(item) ? "Processing has not started yet. You can retry dispatch." : null),
  };
}

export function ArtifactManager({
  examId,
  onMutation,
  initialNotice,
}: {
  examId: string;
  onMutation?: () => void | Promise<void>;
  initialNotice?: string;
}) {
  const [items, setItems] = useState<Artifact[]>([]);
  const [kind, setKind] = useState<SourceKind>("past_exam");
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialNotice ?? null);
  const [uploadFailures, setUploadFailures] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Artifact | null>(null);
  const [pendingAction, setPendingAction] = useState<Record<string, "delete" | "retry">>({});
  const [summary, setSummary] = useState<{ artifactId: string; value: ArtifactSummary } | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const itemsRef = useRef<Artifact[]>([]);
  const onMutationRef = useRef(onMutation);
  const selected = selectedId ? items.find((item) => item.id === selectedId) ?? null : null;

  useEffect(() => {
    onMutationRef.current = onMutation;
  }, [onMutation]);

  const refresh = useCallback(async () => {
    const page = await listArtifacts(examId);
    const previous = new Map(itemsRef.current.map((item) => [item.id, item.processing_status]));
    const reachedTerminalState = page.items.some((item) => {
      const oldStatus = previous.get(item.id);
      return (
        oldStatus !== undefined &&
        oldStatus !== item.processing_status &&
        (item.processing_status === "ready" || item.processing_status === "failed")
      );
    });
    itemsRef.current = page.items;
    setItems(page.items);
    if (reachedTerminalState) void onMutationRef.current?.();
  }, [examId]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void refresh().catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load files.");
      });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [refresh]);

  useEffect(() => {
    if (
      !items.some(
        (item) =>
          item.processing_status === "queued" || item.processing_status === "processing",
      )
    )
      return;
    let active = true;
    const timer = window.setTimeout(() => {
      void refresh().catch(() => {
        if (active) setError("Processing continues, but its latest status could not be loaded.");
      });
    }, 1500);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [items, refresh]);

  useEffect(() => {
    if (!selected || selected.processing_status !== "ready") return;
    let active = true;
    void getArtifactSummary(selected.id)
      .then((nextSummary) => {
        if (active) {
          setSummary({ artifactId: selected.id, value: nextSummary });
          setSummaryError(null);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setSummaryError(reason instanceof Error ? reason.message : "Summary could not be loaded.");
        }
      });
    return () => {
      active = false;
    };
  }, [selected]);

  async function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    if (items.length + files.length > 20) {
      setError("An Exam can contain at most 20 files in P1.");
      return;
    }
    const validationErrors = files.map(validateArtifactFile).filter(Boolean) as string[];
    if (validationErrors.length) {
      setError(validationErrors.join(" "));
      return;
    }
    setBusy(true);
    setError(null);
    setUploadFailures([]);
    const failures: string[] = [];
    for (const file of files) {
      try {
        await uploadArtifact(examId, file, kind, (value) =>
          setProgress((current) => ({ ...current, [file.name]: value })),
        );
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : "upload failed.";
        failures.push(message.startsWith(`${file.name}:`) ? message : `${file.name}: ${message}`);
      } finally {
        setProgress((current) => {
          const next = { ...current };
          delete next[file.name];
          return next;
        });
        try {
          await refresh();
        } catch {
          failures.push(`${file.name}: uploaded, but its latest status could not be loaded.`);
        }
      }
    }
    setBusy(false);
    if (failures.length) setUploadFailures(failures);
    void onMutationRef.current?.();
  }

  async function remove(id: string) {
    if (pendingAction[id]) return;
    setPendingAction((current) => ({ ...current, [id]: "delete" }));
    setError(null);
    let deleted = false;
    try {
      await deleteArtifact(id);
      deleted = true;
      setConfirmDelete(null);
      if (selectedId === id) setSelectedId(null);
      await refresh();
    } catch (reason) {
      setConfirmDelete(null);
      setError(reason instanceof Error ? reason.message : "Delete failed.");
    } finally {
      setPendingAction((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      if (deleted) void onMutationRef.current?.();
    }
  }

  async function retry(id: string) {
    if (pendingAction[id]) return;
    setPendingAction((current) => ({ ...current, [id]: "retry" }));
    setError(null);
    let retried = false;
    try {
      await retryArtifact(id);
      retried = true;
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Retry failed.");
    } finally {
      setPendingAction((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      if (retried) void onMutationRef.current?.();
    }
  }

  async function openDetails(item: Artifact) {
    setSelectedId(item.id);
    setSummary(null);
    setSummaryError(null);
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Context data</h2>
          <p className="mt-1 text-sm text-muted">
            Private PDF, DOCX, and TXT files processed for this Exam.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            aria-label="Artifact category"
            value={kind}
            onChange={(event) => setKind(event.target.value as SourceKind)}
            className="rounded-[9px] border border-line bg-white px-3 text-sm"
          >
            <option value="past_exam">Past exam</option>
            <option value="rubric">Rubric</option>
            <option value="notes">Notes</option>
            <option value="solutions">Solutions</option>
            <option value="syllabus">Syllabus</option>
            <option value="other">Other</option>
          </select>
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[9px] bg-signal px-4 text-sm font-semibold text-white">
            {busy ? <LoaderCircle className="animate-spin" size={15} /> : <Upload size={15} />}
            Add files
            <input
              disabled={busy}
              type="file"
              multiple
              accept=".pdf,.docx,.txt"
              onChange={addFiles}
              className="sr-only"
            />
          </label>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-[9px] border border-danger/20 bg-red-50 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      {uploadFailures.length > 0 && (
        <div role="alert" className="mb-4 rounded-[9px] border border-danger/20 bg-red-50 p-3 text-sm text-danger">
          <p className="font-semibold">
            {uploadFailures.length === 1
              ? "One file did not finish uploading."
              : `${uploadFailures.length} files did not finish uploading.`}{" "}
            Successfully uploaded files are kept below.
          </p>
          <ul className="mt-2 grid list-disc gap-1 pl-5">
            {uploadFailures.map((failure) => (
              <li key={failure}>{failure}</li>
            ))}
          </ul>
        </div>
      )}

      <div aria-live="polite">
        {Object.entries(progress).map(([name, value]) => (
          <div key={name} className="mb-3 rounded-[10px] border border-line p-3">
            <div className="flex justify-between text-xs"><span className="truncate">{name}</span><span>{value}%</span></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
              <div className="h-full bg-signal transition-all" style={{ width: `${value}%` }} />
            </div>
          </div>
        ))}
      </div>

      {items.length ? (
        <div className="divide-y divide-line rounded-[13px] border border-line">
          {items.map((item) => {
            const status = statusView(item);
            return (
              <div key={item.id} className="flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap">
                <span className="grid size-10 place-items-center rounded-[10px] bg-surface text-muted"><FileText size={18} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.original_name}</p>
                  <p className="mt-1 text-xs capitalize text-muted">
                    {item.kind.replace("_", " ")} · {sizeLabel(item.size_bytes)}
                    {item.page_count ? ` · ${item.page_count} pages` : ""}
                  </p>
                  {status.help && <p className={`mt-1 text-xs ${status.tone === "danger" ? "text-danger" : "text-warning"}`}>{status.help}</p>}
                </div>
                <StatusPill tone={status.tone}>{status.label}</StatusPill>
                <button onClick={() => void openDetails(item)} className="grid size-9 place-items-center text-muted hover:text-signal" aria-label={`Details for ${item.original_name}`}><Info size={15} /></button>
                {item.processing_status === "ready" && <button onClick={() => void downloadArtifact(item.id)} className="grid size-9 place-items-center text-muted hover:text-signal" aria-label={`Download ${item.original_name}`}><Download size={15} /></button>}
                {item.upload_status === "uploaded" && (item.processing_status === "failed" || isStuckQueued(item)) && <button onClick={() => void retry(item.id)} disabled={Boolean(pendingAction[item.id])} className="grid size-9 place-items-center text-muted hover:text-signal disabled:cursor-not-allowed disabled:opacity-45" aria-label={`Retry ${item.original_name}`}>{pendingAction[item.id] === "retry" ? <LoaderCircle size={15} className="animate-spin" /> : <RefreshCw size={15} />}</button>}
                <button onClick={() => setConfirmDelete(item)} disabled={Boolean(pendingAction[item.id])} className="grid size-9 place-items-center text-muted hover:text-danger disabled:cursor-not-allowed disabled:opacity-45" aria-label={`Delete ${item.original_name}`}>{pendingAction[item.id] === "delete" ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}</button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[11px] border border-dashed border-line p-8 text-center">
          <FileText size={20} className="mx-auto text-muted" />
          <p className="mt-3 text-sm font-semibold">No context files yet</p>
          <p className="mt-1 text-xs text-muted">Add a PDF, DOCX, or TXT file to ground this Exam.</p>
        </div>
      )}

      {selected && (
        <section className="mt-5 rounded-[13px] border border-line bg-surface-raised p-5" aria-label="Artifact details">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Artifact details</p><h3 className="mt-1 font-semibold">{selected.original_name}</h3></div>
            <button onClick={() => setSelectedId(null)} className="grid size-9 place-items-center text-muted hover:text-ink" aria-label="Close artifact details"><X size={16} /></button>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-xs text-muted">Declared type</dt><dd className="mt-1 break-all font-medium">{selected.declared_media_type}</dd></div>
            <div><dt className="text-xs text-muted">Detected type</dt><dd className="mt-1 break-all font-medium">{selected.detected_media_type ?? "Not detected"}</dd></div>
            <div><dt className="text-xs text-muted">Parser</dt><dd className="mt-1 font-medium">{selected.parser_version ?? "Not processed"}</dd></div>
            <div><dt className="text-xs text-muted">Extracted text</dt><dd className="mt-1 font-medium">{selected.character_count?.toLocaleString() ?? "—"} characters</dd></div>
          </dl>
          {summaryError && <p role="alert" className="mt-5 text-sm text-danger">{summaryError}</p>}
          {summary?.artifactId === selected.id && <div className="mt-5 border-t border-line pt-4"><div className="flex flex-wrap gap-5 text-xs text-muted"><span>{summary.value.page_count} pages</span><span>{summary.value.chunk_count} chunks</span><span>{summary.value.character_count.toLocaleString()} characters</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink">{summary.value.preview || "No text preview available."}</p></div>}
        </section>
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-[2px]"
          onClick={() => {
            if (!pendingAction[confirmDelete.id]) setConfirmDelete(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-artifact-title"
            className="w-full max-w-[440px] rounded-[14px] bg-white p-6 shadow-float"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="delete-artifact-title" className="text-lg font-semibold">
              Delete {confirmDelete.original_name}?
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              The file, its extracted text, and its processed chunks are removed from this Exam.
              This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={Boolean(pendingAction[confirmDelete.id])}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] border border-line bg-white px-4 text-sm font-semibold hover:bg-surface disabled:cursor-not-allowed disabled:opacity-45"
              >
                Cancel
              </button>
              <button
                onClick={() => void remove(confirmDelete.id)}
                disabled={Boolean(pendingAction[confirmDelete.id])}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] border border-line bg-white px-4 text-sm font-semibold text-danger hover:border-danger/30 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {pendingAction[confirmDelete.id] === "delete" ? (
                  <>
                    <LoaderCircle size={15} className="animate-spin" /> Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 size={15} /> Delete file
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
