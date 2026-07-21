"use client";

import { ArrowRight, CalendarDays, Clock3, Plus, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { PageFrame } from "@/components/layout/page-frame";
import { StatusPill } from "@/components/ui/status-pill";
import { useDemo } from "@/features/demo/demo-provider";
import type { ExamStatus } from "@/features/exams/types";

type Sort = "updated" | "title" | "date" | "attempts";

export default function ExamsPage() {
  const { exams, subjects, loading, error, reload } = useDemo();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | ExamStatus>("all");
  const [subjectId, setSubjectId] = useState("all");
  const [sort, setSort] = useState<Sort>("updated");
  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return exams
      .map((exam, index) => ({ exam, index }))
      .filter(({ exam }) => {
        const subject = subjects.find((item) => item.id === exam.subjectId);
        const searchable = `${exam.title} ${exam.examType} ${exam.status} ${subject?.title ?? ""} ${subject?.courseCode ?? ""}`.toLocaleLowerCase();
        return (!term || searchable.includes(term)) && (status === "all" || exam.status === status) && (subjectId === "all" || exam.subjectId === subjectId);
      })
      .sort((left, right) => {
        if (sort === "title") return left.exam.title.localeCompare(right.exam.title);
        if (sort === "date") return (left.exam.targetDate || "9999-12-31").localeCompare(right.exam.targetDate || "9999-12-31");
        if (sort === "attempts") return right.exam.attempts.length - left.exam.attempts.length || left.exam.title.localeCompare(right.exam.title);
        return left.index - right.index;
      })
      .map(({ exam }) => exam);
  }, [exams, query, sort, status, subjectId, subjects]);

  if (loading) return <PageFrame eyebrow="Workspace" title="Exams"><div className="rounded-[14px] border border-line bg-white p-8 text-sm text-muted">Loading your exams…</div></PageFrame>;
  if (error) return <PageFrame eyebrow="Workspace" title="Exams"><div className="rounded-[14px] border border-danger/30 bg-red-50 p-6"><p className="text-sm text-danger">{error}</p><button onClick={() => void reload()} className="mt-4 text-sm font-semibold text-signal">Try again</button></div></PageFrame>;
  return <PageFrame eyebrow={`${exams.length} exams · ${exams.reduce((total, exam) => total + exam.attempts.length, 0)} attempts`} title="Exams" description="Your exam digital twins: source data, verified structure, generation rules, simulations, and results." action={<Link href="/exams/new" className="inline-flex min-h-10 items-center gap-2 rounded-[9px] bg-signal px-4 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(46,46,255,0.18)]"><Plus size={16} /> New exam</Link>}>
    <div className="mb-6 grid gap-3 rounded-[14px] border border-line bg-surface-raised p-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_160px_190px_170px]">
      <label className="flex min-h-11 items-center gap-2.5 rounded-[9px] border border-line bg-white px-3.5 text-sm text-muted"><Search size={16} /><input aria-label="Search exams" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search exams or subjects" className="w-full bg-transparent text-ink outline-none placeholder:text-muted" /></label>
      <label className="relative"><span className="sr-only">Filter exams by status</span><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="min-h-11 w-full appearance-none rounded-[9px] border border-line bg-white px-3 text-sm"><option value="all">All statuses</option><option value="draft">Draft</option><option value="ready">Ready</option></select><SlidersHorizontal size={14} className="pointer-events-none absolute right-3 top-3.5 text-muted" /></label>
      <label><span className="sr-only">Filter exams by subject</span><select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className="min-h-11 w-full rounded-[9px] border border-line bg-white px-3 text-sm"><option value="all">All subjects</option>{subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.title}</option>)}</select></label>
      <label><span className="sr-only">Order exams by</span><select aria-label="Order exams by" value={sort} onChange={(event) => setSort(event.target.value as Sort)} className="min-h-11 w-full rounded-[9px] border border-line bg-white px-3 text-sm"><option value="updated">Recently updated</option><option value="title">Title A–Z</option><option value="date">Target date</option><option value="attempts">Most attempts</option></select></label>
    </div>
    {visible.length ? <div className="grid gap-4 lg:grid-cols-2">{visible.map((exam) => { const subject = subjects.find((item) => item.id === exam.subjectId); return <Link key={exam.id} href={`/exams/${exam.id}`} className="group rounded-[14px] border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#c9c9d0] hover:shadow-soft sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-medium text-muted">{subject?.title} · {subject?.courseCode}</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.025em]">{exam.title}</h2><p className="mt-1 text-sm text-muted">{exam.examType}</p></div><StatusPill tone={exam.status === "ready" ? "success" : "warning"}>{exam.status}</StatusPill></div><div className="mt-6 grid grid-cols-3 gap-2 rounded-[10px] bg-surface p-3 text-center"><div><p className="font-mono text-lg font-semibold">{exam.sources.length}</p><p className="text-[10px] text-muted">Sources</p></div><div><p className="font-mono text-lg font-semibold">{exam.blueprint.length}</p><p className="text-[10px] text-muted">Parts</p></div><div><p className="font-mono text-lg font-semibold">{exam.attempts.length}</p><p className="text-[10px] text-muted">Attempts</p></div></div><div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4 text-xs text-muted"><span className="flex items-center gap-1.5"><Clock3 size={14} /> {exam.rules.durationMinutes} min</span>{exam.targetDate && <span className="flex items-center gap-1.5"><CalendarDays size={14} /> {new Date(`${exam.targetDate}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}<ArrowRight size={15} className="ml-auto transition group-hover:translate-x-1 group-hover:text-signal" /></div></Link>; })}</div> : <div className="grid min-h-[340px] place-items-center rounded-[14px] border border-dashed border-line p-8 text-center"><div><p className="font-semibold">{exams.length ? "No matching exams" : "Create your first exam"}</p><p className="mt-2 text-sm text-muted">{exams.length ? "Try another search or clear a filter." : "An exam owns its data, blueprint, rules, mocks, and history."}</p>{exams.length ? <button type="button" onClick={() => { setQuery(""); setStatus("all"); setSubjectId("all"); }} className="mt-5 text-sm font-semibold text-signal">Clear filters</button> : <Link href="/exams/new" className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-[9px] bg-signal px-4 text-sm font-semibold text-white"><Plus size={16} /> New exam</Link>}</div></div>}
  </PageFrame>;
}
