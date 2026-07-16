"use client";

import { ArrowRight, BookOpen, CalendarDays, Play, Plus, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { StatusPill } from "@/components/ui/status-pill";
import { useCurrentUser } from "@/features/auth/current-user-provider";
import { useDemo } from "@/features/demo/demo-provider";

export default function HomePage() {
  const [now] = useState(() => Date.now());
  const { user } = useCurrentUser();
  const { subjects, exams, loading, error, reload } = useDemo();
  const datedExams = exams.filter((exam) => exam.targetDate).sort((a, b) => a.targetDate.localeCompare(b.targetDate));
  const nextExam = datedExams.find((exam) => new Date(`${exam.targetDate}T00:00:00`).getTime() >= now) ?? datedExams[0] ?? exams[0];
  const nextSubject = subjects.find((subject) => subject.id === nextExam?.subjectId);
  const recentAttempts = exams.flatMap((exam) => exam.attempts.map((attempt) => ({ ...attempt, examTitle: exam.title }))).sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()).slice(0, 3);
  const needsWork = exams.filter((exam) => exam.status === "draft" || !exam.blueprint.length).slice(0, 3);
  const firstName = user?.display_name.split(/\s+/)[0] || "Student";

  if (loading) return <div className="mx-auto max-w-[1280px] px-4 py-10 text-sm text-muted">Loading your workspace…</div>;
  if (error) return <div className="mx-auto max-w-[900px] px-4 py-10"><div className="rounded-[14px] border border-danger/30 bg-red-50 p-6 text-sm text-danger">{error}<button onClick={() => void reload()} className="ml-3 font-semibold text-signal">Try again</button></div></div>;

  if (!subjects.length) return <div className="mx-auto grid min-h-[75dvh] max-w-[760px] place-items-center px-4 py-12 text-center"><div><span className="mx-auto grid size-14 place-items-center rounded-[14px] bg-signal-soft text-signal"><BookOpen size={24} /></span><p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.13em] text-muted">Welcome, {firstName}</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em]">Start with your first Subject.</h1><p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-muted">A Subject keeps related Exams and Classes together. Your account starts empty and private.</p><Link href="/subjects/new" className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-[9px] bg-signal px-5 text-sm font-semibold text-white"><Plus size={16} /> Create subject</Link></div></div>;

  const daysRemaining = nextExam ? Math.ceil((new Date(`${nextExam.targetDate}T00:00:00`).getTime() - now) / 86_400_000) : null;
  return <div className="page-enter mx-auto w-full max-w-[1280px] px-4 py-7 sm:px-7 sm:py-9 xl:px-10">
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-muted">Your workspace</p><h1 className="text-[34px] font-semibold leading-tight tracking-[-0.04em] sm:text-[42px]">Good to see you, {firstName}.</h1><p className="mt-2 text-[15px] text-muted">{exams.length ? `${exams.length} exam${exams.length === 1 ? "" : "s"} across ${subjects.length} subject${subjects.length === 1 ? "" : "s"}.` : "Create an Exam to start a preparation loop."}</p></div><Link href="/exams/new" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] bg-signal px-4 text-sm font-semibold text-white"><Plus size={16} /> New exam</Link></header>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.65fr)]">
      <section className="overflow-hidden rounded-[16px] bg-[#0d0d0d] p-6 text-white sm:p-8"><span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold">Next preparation action</span>{nextExam ? <div className="mt-14 max-w-xl"><p className="text-sm text-white/55">{nextSubject?.title} · {nextSubject?.courseCode}</p><h2 className="mt-3 text-[30px] font-semibold leading-[1.1] tracking-[-0.035em] sm:text-[38px]">{nextExam.title}</h2><p className="mt-4 text-sm leading-6 text-white/62">{nextExam.blueprint.length ? `${nextExam.blueprint.length} blueprint parts · ${nextExam.rules.durationMinutes} minutes.` : "Complete the blueprint before generating a mock."}</p><Link href={nextExam.blueprint.length ? `/exams/${nextExam.id}/run` : `/exams/${nextExam.id}/edit`} className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-white px-4 text-sm font-semibold text-ink">{nextExam.blueprint.length ? <><Play size={16} fill="currentColor" /> Start mock</> : <>Complete exam <ArrowRight size={16} /></>}</Link></div> : <div className="mt-14"><h2 className="text-3xl font-semibold">Create your first Exam.</h2><Link href="/exams/new" className="mt-7 inline-flex rounded-[9px] bg-white px-4 py-3 text-sm font-semibold text-ink">New exam</Link></div>}</section>
      <aside className="rounded-[16px] border border-line bg-surface-raised p-5 sm:p-6"><div className="flex items-center justify-between"><p className="text-sm font-semibold">Next exam</p><CalendarDays size={17} className="text-muted" /></div><p className="mt-8 text-[50px] font-semibold leading-none tracking-[-0.055em]">{daysRemaining === null ? "—" : Math.max(0, daysRemaining)}</p><p className="mt-2 text-sm text-muted">{nextExam ? `days until ${new Date(`${nextExam.targetDate}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}` : "No exam date configured"}</p><div className="mt-7 border-t border-line pt-5"><p className="text-xs text-muted">Current scope</p><p className="mt-2 text-sm font-medium">{subjects.length} Subjects · {exams.length} Exams</p></div></aside>
    </div>

    <div className="mt-6 grid gap-5 lg:grid-cols-2"><section className="rounded-[14px] border border-line bg-white p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Configuration work</h2><p className="mt-1 text-xs text-muted">Exams that still need structure</p></div><Link href="/exams" className="text-xs font-semibold text-signal">View all</Link></div><div className="mt-5 divide-y divide-line">{needsWork.length ? needsWork.map((exam) => <Link key={exam.id} href={`/exams/${exam.id}/edit`} className="flex items-center gap-3 py-3.5"><span className="grid size-9 place-items-center rounded-[9px] bg-surface text-muted"><BookOpen size={16} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{exam.title}</p><p className="mt-0.5 text-xs text-muted">{exam.blueprint.length ? "Review configuration" : "Blueprint required"}</p></div><StatusPill tone="warning">Review</StatusPill></Link>) : <p className="py-8 text-center text-sm text-muted">All current Exams have a blueprint.</p>}</div></section>
      <section className="rounded-[14px] border border-line bg-white p-5 sm:p-6"><div className="flex items-center gap-2"><TrendingUp size={16} className="text-muted" /><h2 className="text-sm font-semibold">Recent attempts</h2></div>{recentAttempts.length ? <div className="mt-5 grid grid-cols-3 gap-2">{recentAttempts.map((attempt) => <div key={attempt.id} className="rounded-[11px] bg-surface p-3.5"><p className="font-mono text-xl font-semibold">{Math.round(attempt.score / attempt.maxScore * 100)}%</p><p className="mt-4 truncate text-xs font-medium">{attempt.examTitle}</p><p className="mt-1 text-[11px] text-muted">{attempt.durationMinutes} min</p></div>)}</div> : <p className="mt-5 rounded-[11px] bg-surface p-6 text-center text-sm text-muted">Complete a mock to start your history.</p>}</section></div>
  </div>;
}
