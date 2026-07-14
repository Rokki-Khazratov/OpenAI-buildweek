"use client";

import { ArrowLeft, CalendarDays, Copy, FilePlus2, MoreHorizontal, Pencil, Plus, Trash2, UsersRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BlueprintRail } from "@/components/data-display/blueprint-rail";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { useDemo } from "@/features/demo/demo-provider";

export function SubjectDetail({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const { subjects, removeSubject } = useDemo();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const subject = subjects.find((item) => item.id === subjectId);

  if (!subject) {
    return <div className="grid min-h-[70dvh] place-items-center px-5 text-center"><div><p className="text-lg font-semibold">Subject not found</p><p className="mt-2 text-sm text-muted">It may have been removed from this visual demo.</p><Link href="/subjects" className="mt-5 inline-flex text-sm font-semibold text-signal">Return to subjects</Link></div></div>;
  }

  function remove() {
    removeSubject(subjectId);
    router.push("/subjects");
  }

  return (
    <div className="page-enter mx-auto w-full max-w-[1280px] px-4 py-7 sm:px-7 sm:py-9 xl:px-10">
      <Link href="/subjects" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink"><ArrowLeft size={16} /> Subjects</Link>
      <header className="flex flex-col gap-6 border-b border-line pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><StatusPill tone={subject.visibility === "team" ? "signal" : "neutral"}>{subject.visibility}</StatusPill><span className="text-xs text-muted">Updated {subject.updatedAt.toLowerCase()}</span></div>
          <h1 className="mt-3 text-[34px] font-semibold tracking-[-0.045em] sm:text-[42px]">{subject.title}</h1>
          <p className="mt-2 text-sm text-muted">{subject.university} · {subject.courseCode}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/subjects/${subject.id}/edit`} className="inline-flex min-h-10 items-center gap-2 rounded-[9px] border border-line bg-white px-4 text-sm font-semibold hover:bg-surface"><Pencil size={15} /> Edit</Link>
          <button className="grid size-10 place-items-center rounded-[9px] border border-line text-muted hover:bg-surface" aria-label="More subject options"><MoreHorizontal size={18} /></button>
        </div>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-[13px] border border-line p-5"><p className="text-xs text-muted">Target exam</p><p className="mt-3 flex items-center gap-2 text-sm font-semibold"><CalendarDays size={16} /> {new Date(subject.targetExamDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p></div>
        <div className="rounded-[13px] border border-line p-5"><p className="text-xs text-muted">Mock history</p><p className="mt-3 font-mono text-2xl font-semibold">{subject.completedMocks}<span className="ml-2 font-sans text-xs font-normal text-muted">completed</span></p></div>
        <div className="rounded-[13px] border border-line p-5"><p className="text-xs text-muted">Current readiness</p><div className="mt-3 flex items-center gap-3"><p className="font-mono text-2xl font-semibold">{subject.readiness}%</p><div className="h-1.5 flex-1 rounded-full bg-surface"><div className="h-full rounded-full bg-signal" style={{ width: `${subject.readiness}%` }} /></div></div></div>
      </section>

      <section className="mt-6 overflow-hidden rounded-[14px] border border-line">
        <div className="flex flex-col gap-4 border-b border-line bg-surface-raised p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-semibold">Exams</h2><p className="mt-1 text-xs text-muted">One subject can contain several exam definitions.</p></div><button className="inline-flex min-h-9 items-center justify-center gap-2 rounded-[8px] bg-contrast px-3.5 text-xs font-semibold text-contrast-ink"><Plus size={14} /> Create exam</button></div>
        {subject.examCount > 0 ? <div className="divide-y divide-line bg-white">
          <div className="flex items-center gap-4 p-5"><span className="grid size-10 place-items-center rounded-[10px] bg-signal-soft font-mono text-xs font-semibold text-signal">F25</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">Final exam 2025</p><p className="mt-1 text-xs text-muted">3 parts · 100 min · blueprint needs review</p></div><StatusPill tone="warning">Review</StatusPill></div>
          {subject.examCount > 1 && <div className="flex items-center gap-4 p-5"><span className="grid size-10 place-items-center rounded-[10px] bg-surface font-mono text-xs font-semibold">M25</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">Midterm 2025</p><p className="mt-1 text-xs text-muted">2 parts · 60 min · 2 sources</p></div><StatusPill tone="success">Ready</StatusPill></div>}
        </div> : <div className="grid min-h-[150px] place-items-center bg-white p-6 text-center"><div><p className="text-sm font-semibold">No exams yet</p><p className="mt-1 text-xs text-muted">Create an exam, then add past papers, rules and notes as context.</p></div></div>}
      </section>

      {subject.examCount > 0 && <section className="mt-6"><BlueprintRail /></section>}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-[14px] border border-line p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Context library</p><p className="mt-1 text-xs text-muted">Past papers, rules, rubrics and notes</p></div><FilePlus2 size={18} className="text-muted" /></div><div className="mt-6 grid grid-cols-3 gap-2 text-center"><div className="rounded-[10px] bg-surface p-3"><p className="font-mono text-xl font-semibold">{subject.examCount ? 6 : 0}</p><p className="mt-1 text-[11px] text-muted">Files</p></div><div className="rounded-[10px] bg-surface p-3"><p className="font-mono text-xl font-semibold">{subject.examCount ? 2 : 0}</p><p className="mt-1 text-[11px] text-muted">Rules</p></div><div className="rounded-[10px] bg-surface p-3"><p className="font-mono text-xl font-semibold">{subject.examCount ? "100%" : "—"}</p><p className="mt-1 text-[11px] text-muted">Processed</p></div></div></section>
        <section className="rounded-[14px] border border-line p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Classes</p><p className="mt-1 text-xs text-muted">Share the subject or selected exams</p></div><UsersRound size={18} className="text-muted" /></div>{subject.visibility === "team" ? <div className="mt-6 flex items-center gap-3 rounded-[10px] bg-surface p-3.5"><span className="grid size-9 place-items-center rounded-full bg-white text-xs font-semibold">SG</span><div className="flex-1"><p className="text-sm font-medium">Study group</p><p className="text-xs text-muted">8 members · Entire subject</p></div><Copy size={15} className="text-muted" /></div> : <div className="mt-6 rounded-[10px] border border-dashed border-line p-4 text-center"><p className="text-xs font-medium">No classes yet</p><p className="mt-1 text-[11px] text-muted">Classes can include this entire Subject or selected Exams.</p></div>}</section>
      </div>

      <section className="mt-10 border-t border-line pt-7"><p className="text-sm font-semibold">Danger zone</p><p className="mt-1 text-xs text-muted">Deleting a subject also removes its exams, context, mocks and local statistics.</p><Button variant="danger" className="mt-4" onClick={() => setConfirmDelete(true)}><Trash2 size={15} /> Delete subject</Button></section>

      {confirmDelete && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-[2px]" onClick={() => setConfirmDelete(false)}><div role="dialog" aria-modal="true" aria-labelledby="delete-title" className="w-full max-w-[420px] rounded-[14px] bg-white p-6 shadow-float" onClick={(event) => event.stopPropagation()}><h2 id="delete-title" className="text-lg font-semibold">Delete {subject.title}?</h2><p className="mt-2 text-sm leading-6 text-muted">This removes the visual demo subject and everything shown inside it. This action cannot be undone.</p><div className="mt-6 flex justify-end gap-2"><Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button><Button variant="danger" onClick={remove}>Delete subject</Button></div></div></div>}
    </div>
  );
}
