"use client";

import { ArrowRight, CalendarDays, Clock3, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { PageFrame } from "@/components/layout/page-frame";
import { StatusPill } from "@/components/ui/status-pill";
import { useDemo } from "@/features/demo/demo-provider";

export default function ExamsPage() {
  const { exams, subjects } = useDemo();
  const [query, setQuery] = useState("");
  const visible = useMemo(() => exams.filter((exam) => `${exam.title} ${exam.examType} ${subjects.find((subject) => subject.id === exam.subjectId)?.title}`.toLowerCase().includes(query.toLowerCase())), [exams, query, subjects]);
  return <PageFrame eyebrow={`${exams.length} exams · ${exams.reduce((total, exam) => total + exam.attempts.length, 0)} attempts`} title="Exams" description="Your exam digital twins: source data, verified structure, generation rules, simulations, and results." action={<Link href="/exams/new" className="inline-flex min-h-10 items-center gap-2 rounded-[9px] bg-signal px-4 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(46,46,255,0.18)]"><Plus size={16} /> New exam</Link>}>
    <label className="mb-6 flex min-h-10 max-w-[440px] items-center gap-2.5 rounded-[9px] border border-line bg-white px-3.5 text-sm text-muted"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search exams or subjects" className="w-full bg-transparent text-ink outline-none placeholder:text-muted" /></label>
    {visible.length ? <div className="grid gap-4 lg:grid-cols-2">{visible.map((exam) => { const subject = subjects.find((item) => item.id === exam.subjectId); return <Link key={exam.id} href={`/exams/${exam.id}`} className="group rounded-[14px] border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#c9c9d0] hover:shadow-soft sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-medium text-muted">{subject?.title} · {subject?.courseCode}</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.025em]">{exam.title}</h2><p className="mt-1 text-sm text-muted">{exam.examType}</p></div><StatusPill tone={exam.status === "ready" ? "success" : "warning"}>{exam.status}</StatusPill></div><div className="mt-6 grid grid-cols-3 gap-2 rounded-[10px] bg-surface p-3 text-center"><div><p className="font-mono text-lg font-semibold">{exam.sources.length}</p><p className="text-[10px] text-muted">Sources</p></div><div><p className="font-mono text-lg font-semibold">{exam.blueprint.length}</p><p className="text-[10px] text-muted">Parts</p></div><div><p className="font-mono text-lg font-semibold">{exam.attempts.length}</p><p className="text-[10px] text-muted">Attempts</p></div></div><div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4 text-xs text-muted"><span className="flex items-center gap-1.5"><Clock3 size={14} /> {exam.rules.durationMinutes} min</span>{exam.targetDate && <span className="flex items-center gap-1.5"><CalendarDays size={14} /> {new Date(`${exam.targetDate}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}<ArrowRight size={15} className="ml-auto transition group-hover:translate-x-1 group-hover:text-signal" /></div></Link>; })}</div> : <div className="grid min-h-[340px] place-items-center rounded-[14px] border border-dashed border-line p-8 text-center"><div><p className="font-semibold">{query ? `No exams match “${query}”` : "Create your first Exam"}</p><p className="mt-2 text-sm text-muted">An Exam owns its data, blueprint, rules, mocks, and history.</p></div></div>}
  </PageFrame>;
}
