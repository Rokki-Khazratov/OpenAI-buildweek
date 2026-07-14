import { ArrowRight, CalendarDays, ChevronRight, FileCheck2, Play, Sparkles } from "lucide-react";
import Link from "next/link";

import { BlueprintRail } from "@/components/data-display/blueprint-rail";
import { StatusPill } from "@/components/ui/status-pill";

export default function HomePage() {
  return (
    <div className="page-enter mx-auto w-full max-w-[1280px] px-4 py-7 sm:px-7 sm:py-9 xl:px-10">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-muted">Tuesday · 14 July</p>
          <h1 className="text-[34px] font-semibold leading-tight tracking-[-0.04em] sm:text-[42px]">Good morning, Rokki.</h1>
          <p className="mt-2 text-[15px] text-muted">Your next exam is 29 days away. One blueprint needs your review.</p>
        </div>
        <Link href="/subjects/new" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] bg-signal px-4 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(46,46,255,0.18)] transition hover:bg-[#2020e8]">
          New subject <ArrowRight size={16} />
        </Link>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.65fr)]">
        <section className="overflow-hidden rounded-[16px] bg-ink p-6 text-white sm:p-8">
          <div className="flex items-center justify-between">
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold">Continue preparation</span>
            <span className="font-mono text-xs text-white/55">PHY-401</span>
          </div>
          <div className="mt-14 max-w-xl">
            <p className="text-sm text-white/55">Quantum Physics · Mock 05</p>
            <h2 className="mt-3 text-[30px] font-semibold leading-[1.1] tracking-[-0.035em] sm:text-[38px]">One more simulation unlocks your reliable trend.</h2>
            <p className="mt-4 max-w-lg text-sm leading-6 text-white/62">This mock increases coverage of derivations and keeps the original 100-minute exam structure.</p>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-white px-4 text-sm font-semibold text-ink transition hover:bg-[#f0f0f2]"><Play size={16} fill="currentColor" /> Start mock exam</button>
            <button className="min-h-11 rounded-[10px] px-4 text-sm font-semibold text-white/78 hover:bg-white/10">Review blueprint</button>
          </div>
        </section>

        <aside className="rounded-[16px] border border-line bg-surface-raised p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Exam countdown</p>
            <CalendarDays size={17} className="text-muted" />
          </div>
          <p className="mt-8 text-[56px] font-semibold leading-none tracking-[-0.055em]">29</p>
          <p className="mt-2 text-sm text-muted">days until 12 August</p>
          <div className="mt-7 h-1.5 overflow-hidden rounded-full bg-[#e5e5e8]"><div className="h-full w-[68%] rounded-full bg-signal" /></div>
          <div className="mt-3 flex justify-between text-xs text-muted"><span>Readiness</span><span className="font-mono text-ink">68%</span></div>
          <div className="mt-7 border-t border-line pt-5">
            <div className="flex items-center gap-2 text-xs text-muted"><Sparkles size={14} className="text-signal" /> Adaptive focus</div>
            <p className="mt-2 text-sm font-medium leading-5">Operator methods and perturbation theory</p>
          </div>
        </aside>
      </div>

      <section className="mt-6">
        <BlueprintRail />
      </section>

      <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-2">
        <section className="min-w-0 rounded-[14px] border border-line bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div><h2 className="text-sm font-semibold">Active work</h2><p className="mt-1 text-xs text-muted">Processing and review tasks</p></div>
            <Link href="/exams" className="text-xs font-semibold text-signal">View all</Link>
          </div>
          <div className="mt-5 divide-y divide-line">
            <div className="flex items-center gap-3 py-3.5">
              <span className="grid size-9 place-items-center rounded-[9px] bg-signal-soft text-signal"><FileCheck2 size={17} /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">Final 2025 blueprint</p><p className="mt-0.5 text-xs text-muted">3 sources processed · needs review</p></div>
              <StatusPill tone="warning">Review</StatusPill>
            </div>
            <div className="flex items-center gap-3 py-3.5">
              <span className="grid size-9 place-items-center rounded-[9px] bg-surface text-muted"><Sparkles size={17} /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">Algorithms mock 03</p><p className="mt-0.5 text-xs text-muted">Generation completed 12 min ago</p></div>
              <StatusPill tone="success">Ready</StatusPill>
            </div>
          </div>
        </section>

        <section className="min-w-0 rounded-[14px] border border-line bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Recent attempts</h2><p className="mt-1 text-xs text-muted">Your last completed mocks</p></div><ChevronRight size={17} className="text-muted" /></div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {[{ score: "74%", label: "Quantum", delta: "+6" }, { score: "81%", label: "Algorithms", delta: "+3" }, { score: "67%", label: "Quantum", delta: "−2" }].map((item) => (
              <div key={`${item.label}-${item.score}`} className="rounded-[11px] bg-surface p-3.5">
                <p className="font-mono text-xl font-semibold tracking-[-0.03em]">{item.score}</p>
                <p className="mt-4 truncate text-xs font-medium">{item.label}</p>
                <p className={`mt-1 text-[11px] ${item.delta.startsWith("−") ? "text-danger" : "text-success"}`}>{item.delta} pts</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
