"use client";

import { Check, Library, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/browser";

import {
  getExamPublication,
  publishExam,
  unpublishExam,
  type LibraryPublication,
} from "./api";

export function PublicationControl({ examId }: { examId: string }) {
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const [publication, setPublication] = useState<LibraryPublication | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(!demoMode);
  const [pending, setPending] = useState(false);
  const [rightsNote, setRightsNote] = useState("Shared for private study use.");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (demoMode) return;
    let active = true;
    void getExamPublication(examId)
      .then((value) => {
        if (active) {
          setPublication(value);
          setRightsNote(value.rights_note);
        }
      })
      .catch((reason: unknown) => {
        if (active && (!(reason instanceof ApiError) || reason.status !== 404)) {
          setError(reason instanceof Error ? reason.message : "Publication status is unavailable.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [demoMode, examId]);

  async function publish() {
    setPending(true);
    setError(null);
    try {
      if (demoMode) {
        setPublication({ id: "demo", is_published: true } as LibraryPublication);
      } else {
        setPublication(await publishExam(examId, rightsNote));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The Exam could not be published.");
    } finally {
      setPending(false);
    }
  }

  async function unpublish() {
    setPending(true);
    setError(null);
    try {
      if (!demoMode) await unpublishExam(examId);
      setPublication((current) => current ? { ...current, is_published: false } : current);
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The publication could not be removed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-[9px] border border-line bg-white px-4 text-sm font-semibold hover:bg-surface disabled:opacity-50">
        {loading ? <LoaderCircle size={15} className="animate-spin" /> : publication?.is_published ? <Check size={15} className="text-success" /> : <Library size={15} />}
        {publication?.is_published ? "In Library" : "Publish"}
      </button>
      {open && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-[2px]" onClick={() => setOpen(false)}>
        <section role="dialog" aria-modal="true" aria-labelledby="publish-title" onClick={(event) => event.stopPropagation()} className="w-full max-w-[520px] rounded-[15px] bg-white p-6 shadow-float">
          <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-signal">Privacy-safe contract</p><h2 id="publish-title" className="mt-2 text-xl font-semibold">{publication?.is_published ? "Published in Library" : "Publish this Exam"}</h2></div><button aria-label="Close" onClick={() => setOpen(false)} className="rounded-md p-2 text-muted hover:bg-surface"><X size={17} /></button></div>
          <div className="mt-5 rounded-[11px] border border-line bg-surface-raised p-4"><p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={16} className="text-success" /> Exact sharing boundary</p><ul className="mt-3 grid gap-2 text-xs leading-5 text-muted"><li>Included: approved blueprint, rules, scenario, and Exam metadata.</li><li>Excluded: files, extracted text, attempts, answers, feedback, and identities.</li><li>Every clone is a new private Subject and remains independent.</li></ul></div>
          <label className="mt-5 block"><span className="text-sm font-medium">Rights note</span><textarea value={rightsNote} onChange={(event) => setRightsNote(event.target.value)} rows={3} maxLength={2000} className="mt-2 w-full resize-y rounded-[9px] border border-line bg-white px-3.5 py-3 text-sm leading-6 outline-hidden focus:border-signal" /></label>
          {error && <p role="alert" className="mt-4 rounded-[9px] border border-danger/30 bg-red-50 p-3 text-sm text-danger">{error}</p>}
          <div className="mt-6 flex flex-wrap justify-end gap-2">{publication?.is_published && <Button variant="danger" onClick={() => void unpublish()} disabled={pending}>Remove from Library</Button>}<Button onClick={() => void publish()} disabled={pending || !rightsNote.trim()}>{pending ? "Saving…" : publication?.is_published ? "Refresh snapshot" : "Publish Exam"}</Button></div>
        </section>
      </div>}
    </>
  );
}
