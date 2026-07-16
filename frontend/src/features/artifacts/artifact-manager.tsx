"use client";

import { Download, FileText, LoaderCircle, RefreshCw, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useState, type ChangeEvent } from "react";

import { StatusPill } from "@/components/ui/status-pill";
import type { SourceKind } from "@/features/exams/types";

import { deleteArtifact, downloadArtifact, listArtifacts, retryArtifact, uploadArtifact } from "./api";
import type { Artifact } from "./types";

const labels: Record<Artifact["processing_status"], string> = {
  pending: "uploading",
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

export function ArtifactManager({ examId }: { examId: string }) {
  const [items, setItems] = useState<Artifact[]>([]);
  const [kind, setKind] = useState<SourceKind>("past_exam");
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const page = await listArtifacts(examId);
    setItems(page.items);
  }, [examId]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void refresh().catch((reason: unknown) => active && setError(reason instanceof Error ? reason.message : "Unable to load files."));
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [refresh]);

  useEffect(() => {
    if (!items.some((item) => item.processing_status === "queued" || item.processing_status === "processing")) return;
    const timer = window.setInterval(() => void refresh(), 1500);
    return () => window.clearInterval(timer);
  }, [items, refresh]);

  async function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of files) {
        await uploadArtifact(examId, file, kind, (value) => setProgress((current) => ({ ...current, [file.name]: value })));
        setProgress((current) => { const next = { ...current }; delete next[file.name]; return next; });
        await refresh();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Upload failed.");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try { await deleteArtifact(id); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Delete failed."); }
  }

  async function retry(id: string) {
    setError(null);
    try { await retryArtifact(id); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Retry failed."); }
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Context data</h2>
          <p className="mt-1 text-sm text-muted">Private PDF, DOCX, and TXT files processed for this Exam.</p>
        </div>
        <div className="flex gap-2">
          <select value={kind} onChange={(event) => setKind(event.target.value as SourceKind)} className="rounded-[9px] border border-line bg-white px-3 text-sm">
            <option value="past_exam">Past exam</option><option value="rubric">Rubric</option><option value="notes">Notes</option><option value="solutions">Solutions</option><option value="syllabus">Syllabus</option><option value="other">Other</option>
          </select>
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[9px] bg-signal px-4 text-sm font-semibold text-white">
            {busy ? <LoaderCircle className="animate-spin" size={15} /> : <Upload size={15} />} Add files
            <input disabled={busy} type="file" multiple accept=".pdf,.docx,.txt" onChange={addFiles} className="sr-only" />
          </label>
        </div>
      </div>
      {error && <div role="alert" className="mb-4 rounded-[9px] border border-danger/20 bg-red-50 p-3 text-sm text-danger">{error}</div>}
      {Object.entries(progress).map(([name, value]) => <div key={name} className="mb-3 rounded-[10px] border border-line p-3"><div className="flex justify-between text-xs"><span className="truncate">{name}</span><span>{value}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface"><div className="h-full bg-signal transition-all" style={{ width: `${value}%` }} /></div></div>)}
      {items.length ? <div className="divide-y divide-line rounded-[13px] border border-line">{items.map((item) => <div key={item.id} className="flex items-center gap-3 p-4"><span className="grid size-10 place-items-center rounded-[10px] bg-surface text-muted"><FileText size={18} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.original_name}</p><p className="mt-1 text-xs capitalize text-muted">{item.kind.replace("_", " ")} · {sizeLabel(item.size_bytes)}{item.page_count ? ` · ${item.page_count} pages` : ""}</p>{item.failure_message && <p className="mt-1 text-xs text-danger">{item.failure_message}</p>}</div><StatusPill tone={item.processing_status === "ready" ? "success" : item.processing_status === "failed" ? "danger" : "warning"}>{labels[item.processing_status]}</StatusPill>{item.processing_status === "ready" && <button onClick={() => void downloadArtifact(item.id)} className="grid size-9 place-items-center text-muted hover:text-signal" aria-label={`Download ${item.original_name}`}><Download size={15} /></button>}{(item.processing_status === "failed" || item.processing_status === "queued") && <button onClick={() => void retry(item.id)} className="grid size-9 place-items-center text-muted hover:text-signal" aria-label={`Retry ${item.original_name}`}><RefreshCw size={15} /></button>}<button onClick={() => void remove(item.id)} className="grid size-9 place-items-center text-muted hover:text-danger" aria-label={`Delete ${item.original_name}`}><Trash2 size={15} /></button></div>)}</div> : <div className="rounded-[11px] border border-dashed border-line p-8 text-center"><FileText size={20} className="mx-auto text-muted" /><p className="mt-3 text-sm font-semibold">No context files yet</p><p className="mt-1 text-xs text-muted">Add a PDF, DOCX, or TXT file to ground this Exam.</p></div>}
    </div>
  );
}
