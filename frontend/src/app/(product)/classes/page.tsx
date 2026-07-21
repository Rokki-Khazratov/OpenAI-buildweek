"use client";

import { ArrowRight, BookOpen, Plus, Search, SlidersHorizontal, UsersRound } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { PageFrame } from "@/components/layout/page-frame";
import { StatusPill } from "@/components/ui/status-pill";
import { useDemo } from "@/features/demo/demo-provider";
import type { ClassExamScope } from "@/features/classes/types";

type Sort = "updated" | "name" | "members";

export default function ClassesPage() {
  const { classes, subjects, loading, error, reload } = useDemo();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"all" | ClassExamScope>("all");
  const [subjectId, setSubjectId] = useState("all");
  const [sort, setSort] = useState<Sort>("updated");
  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return classes
      .map((studyClass, index) => ({ studyClass, index }))
      .filter(({ studyClass }) => {
        const subject = subjects.find((item) => item.id === studyClass.subjectId);
        const searchable = `${studyClass.name} ${studyClass.description} ${subject?.title ?? ""} ${subject?.courseCode ?? ""}`.toLocaleLowerCase();
        return (!term || searchable.includes(term)) && (scope === "all" || studyClass.examScope === scope) && (subjectId === "all" || studyClass.subjectId === subjectId);
      })
      .sort((left, right) => sort === "name" ? left.studyClass.name.localeCompare(right.studyClass.name) : sort === "members" ? right.studyClass.memberCount - left.studyClass.memberCount || left.studyClass.name.localeCompare(right.studyClass.name) : left.index - right.index)
      .map(({ studyClass }) => studyClass);
  }, [classes, query, scope, sort, subjectId, subjects]);

  if (loading) return <PageFrame eyebrow="Study together" title="Classes"><div className="rounded-[14px] border border-line bg-white p-8 text-sm text-muted">Loading your classes…</div></PageFrame>;
  if (error) return <PageFrame eyebrow="Study together" title="Classes"><div className="rounded-[14px] border border-danger/30 bg-red-50 p-6"><p className="text-sm text-danger">{error}</p><button onClick={() => void reload()} className="mt-4 text-sm font-semibold text-signal">Try again</button></div></PageFrame>;

  return (
    <PageFrame eyebrow="Study together" title="Classes" description="Create focused study groups around an entire subject or selected exams." action={<Link href="/classes/new" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] bg-signal px-4 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(46,46,255,0.18)]"><Plus size={16} /> New class</Link>}>
      <div className="mb-6 grid gap-3 rounded-[14px] border border-line bg-surface-raised p-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_180px_190px_170px]">
        <label className="flex min-h-11 items-center gap-2.5 rounded-[9px] border border-line bg-white px-3.5 text-sm text-muted"><Search size={16} /><input aria-label="Search classes" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search classes or subjects" className="w-full bg-transparent text-ink outline-none placeholder:text-muted" /></label>
        <label className="relative"><span className="sr-only">Filter classes by scope</span><select value={scope} onChange={(event) => setScope(event.target.value as typeof scope)} className="min-h-11 w-full appearance-none rounded-[9px] border border-line bg-white px-3 text-sm"><option value="all">All scopes</option><option value="subject">Entire subject</option><option value="selected">Selected exams</option></select><SlidersHorizontal size={14} className="pointer-events-none absolute right-3 top-3.5 text-muted" /></label>
        <label><span className="sr-only">Filter classes by subject</span><select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className="min-h-11 w-full rounded-[9px] border border-line bg-white px-3 text-sm"><option value="all">All subjects</option>{subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.title}</option>)}</select></label>
        <label><span className="sr-only">Order classes by</span><select aria-label="Order classes by" value={sort} onChange={(event) => setSort(event.target.value as Sort)} className="min-h-11 w-full rounded-[9px] border border-line bg-white px-3 text-sm"><option value="updated">Recently updated</option><option value="name">Name A–Z</option><option value="members">Most members</option></select></label>
      </div>
      {visible.length ? <div className="grid gap-4 xl:grid-cols-2">{visible.map((studyClass) => {
        const subject = subjects.find((item) => item.id === studyClass.subjectId);
        return <Link key={studyClass.id} href={`/classes/${studyClass.id}`} className="group rounded-[14px] border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#c9c9d0] hover:shadow-soft sm:p-6">
          <div className="flex items-start justify-between gap-4"><span className="grid size-11 place-items-center rounded-[11px] bg-signal-soft text-signal"><UsersRound size={20} /></span><StatusPill tone={studyClass.examScope === "subject" ? "signal" : "neutral"}>{studyClass.examScope === "subject" ? "Entire subject" : `${studyClass.examIds.length} exam${studyClass.examIds.length === 1 ? "" : "s"}`}</StatusPill></div>
          <h2 className="mt-5 text-lg font-semibold tracking-[-0.02em]">{studyClass.name}</h2>
          <p className="mt-1 text-sm text-muted">{subject?.title ?? "Subject unavailable"} · {subject?.courseCode}</p>
          <p className="mt-4 min-h-10 text-sm leading-5 text-muted">{studyClass.description || "No class description yet."}</p>
          <div className="mt-5 flex items-center justify-between border-t border-line pt-4"><span className="text-xs text-muted">{studyClass.memberCount} participant{studyClass.memberCount === 1 ? "" : "s"} · Updated {studyClass.updatedAt.toLowerCase()}</span><ArrowRight size={16} className="text-muted transition group-hover:translate-x-1 group-hover:text-signal" /></div>
        </Link>;
      })}</div> : <div className="grid min-h-[360px] place-items-center rounded-[14px] border border-dashed border-line bg-surface-raised p-6 text-center"><div className="max-w-sm"><BookOpen size={24} className="mx-auto text-muted" /><h2 className="mt-5 text-lg font-semibold">{classes.length ? "No matching classes" : "Create your first class"}</h2><p className="mt-2 text-sm leading-6 text-muted">{classes.length ? "Try another search or clear a filter." : "Choose a subject and save a subject-wide or selected-exam scope."}</p>{classes.length ? <button type="button" onClick={() => { setQuery(""); setScope("all"); setSubjectId("all"); }} className="mt-5 text-sm font-semibold text-signal">Clear filters</button> : <Link href="/classes/new" className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-[9px] bg-signal px-4 text-sm font-semibold text-white"><Plus size={16} /> New class</Link>}</div></div>}
    </PageFrame>
  );
}
