"use client";

import { ArrowLeft, ArrowRight, FilePlus2, Pencil, Plus, Trash2, UsersRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { useDemo } from "@/features/demo/demo-provider";

export function SubjectDetail({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const { subjects, exams, classes, removeSubject } = useDemo();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const subject = subjects.find((item) => item.id === subjectId);
  const subjectExams = exams.filter((exam) => exam.subjectId === subjectId);
  const subjectClasses = classes.filter((studyClass) => studyClass.subjectId === subjectId);

  if (!subject) return <div className="grid min-h-[70dvh] place-items-center px-5 text-center"><div><p className="text-lg font-semibold">Subject not found</p><Link href="/subjects" className="mt-5 inline-flex text-sm font-semibold text-signal">Return to subjects</Link></div></div>;

  function remove() {
    removeSubject(subjectId);
    router.push("/subjects");
  }

  return <div className="page-enter mx-auto w-full max-w-[1180px] px-4 py-7 sm:px-7 sm:py-9 xl:px-10">
    <Link href="/subjects" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink"><ArrowLeft size={16} /> Subjects</Link>
    <header className="flex flex-col gap-6 border-b border-line pb-7 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2"><StatusPill tone={subject.visibility === "team" ? "signal" : "neutral"}>{subject.visibility}</StatusPill><span className="text-xs text-muted">Updated {subject.updatedAt.toLowerCase()}</span></div><h1 className="mt-3 text-[34px] font-semibold tracking-[-0.045em] sm:text-[42px]">{subject.title}</h1><p className="mt-2 text-sm text-muted">{subject.university} · {subject.courseCode}</p></div><Link href={`/subjects/${subject.id}/edit`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] border border-line bg-white px-4 text-sm font-semibold hover:bg-surface"><Pencil size={15} /> Edit category</Link></header>

    <section className="mt-7 overflow-hidden rounded-[14px] border border-line"><div className="flex flex-col gap-4 border-b border-line bg-surface-raised p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-semibold">Exams</h2><p className="mt-1 text-xs text-muted">Each Exam owns its context, blueprint, rules, simulations, and history.</p></div><Link href={`/exams/new?subject=${subject.id}`} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-[8px] bg-contrast px-3.5 text-xs font-semibold text-contrast-ink"><Plus size={14} /> Create exam</Link></div>
      {subjectExams.length ? <div className="divide-y divide-line bg-white">{subjectExams.map((exam) => <Link key={exam.id} href={`/exams/${exam.id}`} className="group flex items-center gap-4 p-5 hover:bg-surface-raised"><span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-signal-soft font-mono text-[11px] font-semibold text-signal">{exam.examType.slice(0, 2).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{exam.title}</p><p className="mt-1 text-xs text-muted">{exam.blueprint.length} parts · {exam.rules.durationMinutes} min · {exam.sources.length} sources</p></div><StatusPill tone={exam.status === "ready" ? "success" : "warning"}>{exam.status}</StatusPill><ArrowRight size={16} className="text-muted transition group-hover:translate-x-1 group-hover:text-signal" /></Link>)}</div> : <div className="grid min-h-[180px] place-items-center bg-white p-6 text-center"><div><FilePlus2 size={22} className="mx-auto text-muted" /><p className="mt-4 text-sm font-semibold">No exams in this subject</p><p className="mt-1 text-xs text-muted">Create an Exam, then add its source data, blueprint, scenario, and rules.</p></div></div>}
    </section>

    <section className="mt-6 rounded-[14px] border border-line p-5"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Classes</h2><p className="mt-1 text-xs text-muted">Study groups connected to this category or selected exams.</p></div><UsersRound size={18} className="text-muted" /></div>{subjectClasses.length ? <div className="mt-4 grid gap-2">{subjectClasses.map((studyClass) => <Link key={studyClass.id} href={`/classes/${studyClass.id}`} className="flex items-center justify-between rounded-[10px] bg-surface p-3.5"><div><p className="text-sm font-medium">{studyClass.name}</p><p className="text-xs text-muted">{studyClass.memberCount} members</p></div><ArrowRight size={15} className="text-muted" /></Link>)}</div> : <p className="mt-5 rounded-[10px] border border-dashed border-line p-4 text-center text-xs text-muted">No classes in this subject.</p>}</section>

    <section className="mt-10 border-t border-line pt-7"><p className="text-sm font-semibold">Danger zone</p><p className="mt-1 text-xs text-muted">Deleting this category also removes its Exams and Classes, including local attempt history.</p><Button variant="danger" className="mt-4" onClick={() => setConfirmDelete(true)}><Trash2 size={15} /> Delete subject</Button></section>
    {confirmDelete && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-[2px]" onClick={() => setConfirmDelete(false)}><div role="dialog" aria-modal="true" aria-labelledby="delete-title" className="w-full max-w-[420px] rounded-[14px] bg-white p-6 shadow-float" onClick={(event) => event.stopPropagation()}><h2 id="delete-title" className="text-lg font-semibold">Delete {subject.title}?</h2><p className="mt-2 text-sm leading-6 text-muted">This removes the category, {subjectExams.length} exams, and their local history. This action cannot be undone.</p><div className="mt-6 flex justify-end gap-2"><Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button><Button variant="danger" onClick={remove}>Delete subject</Button></div></div></div>}
  </div>;
}
