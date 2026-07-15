"use client";

import { ArrowRight, BookOpen, Plus, UsersRound } from "lucide-react";
import Link from "next/link";

import { PageFrame } from "@/components/layout/page-frame";
import { StatusPill } from "@/components/ui/status-pill";
import { useDemo } from "@/features/demo/demo-provider";

export default function ClassesPage() {
  const { classes, subjects } = useDemo();

  return (
    <PageFrame eyebrow="Study together" title="Classes" description="Create focused study groups around an entire subject or selected exams." action={<Link href="/classes/new" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] bg-signal px-4 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(46,46,255,0.18)]"><Plus size={16} /> New class</Link>}>
      {classes.length ? <div className="grid gap-4 lg:grid-cols-2">{classes.map((studyClass) => {
        const subject = subjects.find((item) => item.id === studyClass.subjectId);
        return <Link key={studyClass.id} href={`/classes/${studyClass.id}`} className="group rounded-[14px] border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#c9c9d0] hover:shadow-soft sm:p-6">
          <div className="flex items-start justify-between gap-4"><span className="grid size-11 place-items-center rounded-[11px] bg-signal-soft text-signal"><UsersRound size={20} /></span><StatusPill tone={studyClass.examScope === "subject" ? "signal" : "neutral"}>{studyClass.examScope === "subject" ? "Entire subject" : `${studyClass.examIds.length} exam${studyClass.examIds.length === 1 ? "" : "s"}`}</StatusPill></div>
          <h2 className="mt-5 text-lg font-semibold tracking-[-0.02em]">{studyClass.name}</h2>
          <p className="mt-1 text-sm text-muted">{subject?.title ?? "Subject unavailable"} · {subject?.courseCode}</p>
          <p className="mt-4 min-h-10 text-sm leading-5 text-muted">{studyClass.description || "No class description yet."}</p>
          <div className="mt-5 flex items-center justify-between border-t border-line pt-4"><span className="text-xs text-muted">{studyClass.memberCount} member{studyClass.memberCount === 1 ? "" : "s"} · Updated {studyClass.updatedAt.toLowerCase()}</span><ArrowRight size={16} className="text-muted transition group-hover:translate-x-1 group-hover:text-signal" /></div>
        </Link>;
      })}</div> : <div className="grid min-h-[360px] place-items-center rounded-[14px] border border-dashed border-line bg-surface-raised p-6 text-center"><div className="max-w-sm"><span className="mx-auto grid size-12 place-items-center rounded-[12px] bg-white text-muted shadow-soft"><BookOpen size={21} /></span><h2 className="mt-5 text-lg font-semibold">Create your first class</h2><p className="mt-2 text-sm leading-6 text-muted">Choose a subject, decide what to share, and invite people to prepare together.</p><Link href="/classes/new" className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-[9px] bg-signal px-4 text-sm font-semibold text-white"><Plus size={16} /> New class</Link></div></div>}
    </PageFrame>
  );
}
