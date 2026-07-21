"use client";

import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Pencil,
  ShieldCheck,
  Trash2,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { ClassDashboard } from "@/features/classes/class-dashboard";
import { useDemo } from "@/features/demo/demo-provider";

export function ClassDetail({ classId }: { classId: string }) {
  const router = useRouter();
  const { classes, subjects, exams, loading, removeClass } = useDemo();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const studyClass = classes.find((item) => item.id === classId);
  const subject = subjects.find((item) => item.id === studyClass?.subjectId);

  if (loading) return <div className="grid min-h-[70dvh] place-items-center text-sm text-muted">Loading class…</div>;
  if (!studyClass) return <div className="grid min-h-[70dvh] place-items-center px-5 text-center"><div><p className="text-lg font-semibold">Class not found</p><p className="mt-2 text-sm text-muted">It may have been deleted or you may not have access.</p><Link href="/classes" className="mt-5 inline-flex text-sm font-semibold text-signal">Return to classes</Link></div></div>;

  async function remove() {
    await removeClass(classId);
    router.push("/classes");
  }

  return <div className="page-enter mx-auto w-full max-w-[1280px] px-4 py-7 sm:px-7 sm:py-9 xl:px-10">
    <Link href="/classes" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink"><ArrowLeft size={16} /> Classes</Link>
    <header className="flex flex-col gap-6 border-b border-line pb-7 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><StatusPill tone="signal">Active cohort</StatusPill><StatusPill tone="neutral">{studyClass.examScope === "subject" ? "Entire subject" : "Selected exams"}</StatusPill><span className="text-xs text-muted">Updated {studyClass.updatedAt.toLowerCase()}</span></div><h1 className="mt-3 text-[34px] font-semibold tracking-[-0.045em] sm:text-[42px]">{studyClass.name}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{studyClass.description || "No class description yet."}</p></div><Link href={`/classes/${studyClass.id}/edit`} className="inline-flex min-h-10 items-center gap-2 rounded-[9px] border border-line bg-white px-4 text-sm font-semibold hover:bg-surface"><Pencil size={15} /> Edit scope</Link></header>
    <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-[13px] border border-line p-4"><p className="text-[11px] text-muted">Subject</p><p className="mt-2 flex items-center gap-2 text-sm font-semibold"><BookOpen size={15} /> {subject?.title ?? "Unavailable"}</p></div>
      <div className="rounded-[13px] border border-line p-4"><p className="text-[11px] text-muted">Scope</p><p className="mt-2 text-sm font-semibold">{studyClass.examScope === "subject" ? "All subject exams" : `${studyClass.examIds.length} selected exam${studyClass.examIds.length === 1 ? "" : "s"}`}</p></div>
      <div className="rounded-[13px] border border-line p-4"><p className="text-[11px] text-muted">Privacy</p><p className="mt-2 flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={15} className="text-success" /> Aggregates only</p></div>
      <div className="rounded-[13px] border border-line p-4"><p className="text-[11px] text-muted">Created</p><p className="mt-2 flex items-center gap-2 text-sm font-semibold"><CalendarDays size={15} /> {studyClass.createdAt}</p></div>
    </section>
    <ClassDashboard studyClass={studyClass} exams={exams} />
    <section className="mt-10 border-t border-line pt-7"><p className="text-sm font-semibold">Danger zone</p><p className="mt-1 text-xs text-muted">Deleting a class removes membership and its saved scope. Subjects, Exams, and personal attempts stay untouched.</p><Button variant="danger" className="mt-4" onClick={() => setConfirmDelete(true)}><Trash2 size={15} /> Delete class</Button></section>
    {confirmDelete && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-[2px]" onClick={() => setConfirmDelete(false)}><div role="dialog" aria-modal="true" aria-labelledby="delete-class-title" className="w-full max-w-[420px] rounded-[14px] bg-white p-6 shadow-float" onClick={(event) => event.stopPropagation()}><span className="grid size-10 place-items-center rounded-[10px] bg-red-50 text-danger"><UsersRound size={18} /></span><h2 id="delete-class-title" className="mt-4 text-lg font-semibold">Delete {studyClass.name}?</h2><p className="mt-2 text-sm leading-6 text-muted">Class membership and cohort scope will be removed. The subject, Exams, and attempts remain intact.</p><div className="mt-6 flex justify-end gap-2"><Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button><Button variant="danger" onClick={() => void remove()}>Delete class</Button></div></div></div>}
  </div>;
}
