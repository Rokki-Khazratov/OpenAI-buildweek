"use client";

import { ArrowLeft, BarChart3, Clock3, Info, Play, Target } from "lucide-react";
import Link from "next/link";

import { StatusPill } from "@/components/ui/status-pill";
import { useDemo } from "@/features/demo/demo-provider";

export function ExamStatistics({ examId }: { examId: string }) {
  const { exams, loading } = useDemo();
  const exam = exams.find((item) => item.id === examId);
  if (loading) return <div className="p-10 text-sm text-muted">Loading statistics…</div>;
  if (!exam) return <div className="p-10 text-sm text-muted">Exam not found or unavailable.</div>;
  const attempts = [...exam.attempts].reverse();
  const latest = exam.attempts[0];
  const average = attempts.length ? Math.round(attempts.reduce((total, attempt) => total + attempt.score / attempt.maxScore * 100, 0) / attempts.length) : 0;

  return <div className="page-enter mx-auto w-full max-w-[1180px] px-4 py-7 sm:px-7 sm:py-9 xl:px-10"><Link href={`/exams/${exam.id}`} className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink"><ArrowLeft size={16} /> {exam.title}</Link><header className="flex flex-col gap-5 border-b border-line pb-7 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2"><StatusPill tone="neutral">Soon: full analytics</StatusPill><span className="text-xs text-muted">{attempts.length} completed attempts</span></div><h1 className="mt-3 text-[34px] font-semibold tracking-[-0.045em] sm:text-[42px]">Exam statistics</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Available observations now; mastery, skills, timing, and error analysis unlock as real evaluation data accumulates.</p></div><Link href={`/exams/${exam.id}/run`} className="inline-flex min-h-10 items-center gap-2 rounded-[9px] bg-signal px-4 text-sm font-semibold text-white"><Play size={15} fill="currentColor" /> Run another mock</Link></header>
    <section className="mt-6 grid gap-4 sm:grid-cols-3"><Metric icon={Target} label="Latest score" value={latest ? `${Math.round(latest.score / latest.maxScore * 100)}%` : "—"} /><Metric icon={BarChart3} label="Average score" value={attempts.length ? `${average}%` : "—"} /><Metric icon={Clock3} label="Latest duration" value={latest ? `${latest.durationMinutes} min` : "—"} /></section>
    {attempts.length < 5 && <div className="mt-6 flex gap-3 rounded-[12px] border border-line bg-surface-raised p-4"><Info size={18} className="mt-0.5 shrink-0 text-signal" /><div><p className="text-sm font-semibold">Low-confidence view</p><p className="mt-1 text-xs leading-5 text-muted">Complete {5 - attempts.length} more attempt{5 - attempts.length === 1 ? "" : "s"} before treating trends as reliable. Scores remain visible, but ExamTwin will not overstate mastery from sparse evidence.</p></div></div>}
    <div className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_1fr]"><section className="rounded-[14px] border border-line p-5 sm:p-6"><h2 className="text-sm font-semibold">Score trajectory</h2><p className="mt-1 text-xs text-muted">Completed simulations in chronological order.</p>{attempts.length ? <div className="mt-8 flex h-52 items-end gap-4 border-b border-line px-3">{attempts.map((attempt, index) => { const score = Math.round(attempt.score / attempt.maxScore * 100); return <div key={attempt.id} className="flex h-full flex-1 flex-col justify-end text-center"><span className="mb-2 font-mono text-xs font-semibold">{score}%</span><div className="mx-auto w-full max-w-14 rounded-t-[7px] bg-signal transition" style={{ height: `${Math.max(8, score)}%` }} /><span className="mt-2 text-[10px] text-muted">#{index + 1}</span></div>; })}</div> : <EmptyStats />}</section><section className="rounded-[14px] border border-line p-5 sm:p-6"><h2 className="text-sm font-semibold">Analysis roadmap</h2><p className="mt-1 text-xs text-muted">This page is ready for the real evaluation contract.</p><div className="mt-5 grid gap-3">{["Blueprint part mastery", "Skill evidence and confidence", "Time allocation", "Error types", "Adaptive next mock"].map((item) => <div key={item} className="flex items-center justify-between rounded-[9px] bg-surface p-3 text-sm"><span>{item}</span><span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">Soon</span></div>)}</div></section></div>
  </div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) {
  return <div className="rounded-[13px] border border-line p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted">{label}</p><Icon size={16} className="text-muted" /></div><p className="mt-4 font-mono text-3xl font-semibold tracking-[-0.04em]">{value}</p></div>;
}

function EmptyStats() {
  return <div className="grid min-h-52 place-items-center text-center"><div><BarChart3 size={22} className="mx-auto text-muted" /><p className="mt-3 text-sm font-semibold">No results yet</p><p className="mt-1 text-xs text-muted">Complete a mock to create the first observation.</p></div></div>;
}
