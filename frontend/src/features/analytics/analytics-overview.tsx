"use client";

import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CalendarClock,
  RefreshCw,
  Route,
  ShieldQuestion,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { useDemo } from "@/features/demo/demo-provider";

import { getAnalyticsOverview } from "./api";
import { demoAnalyticsOverview } from "./demo";
import type { AnalyticsOverview } from "./types";

type State =
  | { status: "loading" }
  | { status: "ready"; data: AnalyticsOverview }
  | { status: "error"; message: string };

export function AnalyticsOverviewScreen({ view }: { view: "analytics" | "statistics" }) {
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const { exams, loading: workspaceLoading } = useDemo();
  const [state, setState] = useState<State>({ status: "loading" });
  const demoData = useMemo(() => demoAnalyticsOverview(exams), [exams]);

  const load = useCallback(async () => {
    if (demoMode) return;
    setState({ status: "loading" });
    try {
      setState({ status: "ready", data: await getAnalyticsOverview() });
    } catch (reason) {
      setState({
        status: "error",
        message: reason instanceof Error ? reason.message : "Analytics could not be loaded.",
      });
    }
  }, [demoMode]);

  useEffect(() => {
    if (demoMode) return;
    let active = true;
    void getAnalyticsOverview()
      .then((data) => {
        if (active) setState({ status: "ready", data });
      })
      .catch((reason: unknown) => {
        if (active) {
          setState({
            status: "error",
            message: reason instanceof Error ? reason.message : "Analytics could not be loaded.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [demoMode]);

  if ((demoMode && workspaceLoading) || (!demoMode && state.status === "loading")) {
    return <OverviewSkeleton />;
  }
  if (!demoMode && state.status === "error") {
    return (
      <main className="mx-auto grid min-h-[70vh] max-w-3xl place-items-center px-5 text-center">
        <div>
          <ShieldQuestion className="mx-auto text-warning" />
          <h1 className="mt-4 text-2xl font-semibold">Analytics is unavailable</h1>
          <p className="mt-2 text-sm text-muted">{state.message}</p>
          <Button className="mt-5" onClick={load}><RefreshCw size={15} /> Retry</Button>
        </div>
      </main>
    );
  }

  const data = demoMode ? demoData : state.status === "ready" ? state.data : demoData;
  return <OverviewContent data={data} view={view} />;
}

function OverviewContent({ data, view }: { data: AnalyticsOverview; view: "analytics" | "statistics" }) {
  const decisionFirst = view === "analytics";
  return (
    <main className="page-enter mx-auto w-full max-w-[1240px] px-4 py-7 sm:px-7 sm:py-10 xl:px-10">
      <header className="grid gap-6 border-b border-line pb-7 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone="signal">{data.model_version}</StatusPill>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
              computed {new Date(data.computed_at).toLocaleString("en-GB")}
            </span>
          </div>
          <h1 className="mt-4 text-[38px] font-semibold tracking-[-0.055em] sm:text-[48px]">
            {decisionFirst ? "Preparation intelligence" : "Evidence over time"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            {decisionFirst
              ? "One explainable next move across your exams. Every signal shows how much evidence supports it."
              : "Scores, readiness, coverage, and skill confidence — separated so an early signal never looks like a fact."}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[12px] border border-line bg-line">
          <HeaderFact label="Attempts" value={String(data.total_attempts)} />
          <HeaderFact label="Evaluations" value={String(data.total_evaluated_questions)} />
          <HeaderFact label="Established" value={String(data.established_skill_count)} />
        </div>
      </header>

      {decisionFirst ? <DecisionLedger data={data} /> : <TrajectoryLedger data={data} />}
      {decisionFirst ? <TrajectoryLedger data={data} compact /> : <DecisionLedger data={data} compact />}

      <section className="mt-7 border-t border-line pt-7" aria-labelledby="exam-readiness-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="exam-readiness-title" className="text-lg font-semibold tracking-[-0.025em]">Exam readiness ledger</h2>
            <p className="mt-1 text-xs text-muted">Index and confidence are shown separately.</p>
          </div>
          <span className="font-mono text-[10px] text-muted">
            {data.developing_skill_count} developing · {data.low_evidence_skill_count} low evidence
          </span>
        </div>
        <div className="mt-5 grid gap-3">
          {data.exams.map((exam) => <ExamReadinessRow key={exam.exam_id} exam={exam} />)}
          {data.exams.length === 0 && (
            <div className="rounded-[14px] border border-dashed border-line p-8 text-center">
              <p className="text-sm font-semibold">No exams to analyse</p>
              <p className="mt-1 text-xs text-muted">Create an exam and complete a diagnostic mock.</p>
              <Link href="/exams/new" className="mt-4 inline-flex text-sm font-semibold text-signal">Create exam</Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function DecisionLedger({ data, compact = false }: { data: AnalyticsOverview; compact?: boolean }) {
  const action = data.next_action;
  const exam = data.exams.find((item) => item.exam_id === action?.exam_id);
  return (
    <section className={`mt-7 grid overflow-hidden rounded-[16px] border border-line ${compact ? "lg:grid-cols-[1fr_310px]" : "lg:grid-cols-[1.45fr_1fr]"}`}>
      <div className="relative bg-contrast p-6 text-contrast-ink sm:p-8">
        <div className="absolute right-6 top-6 font-mono text-[10px] uppercase tracking-[0.12em] opacity-50">next / best action</div>
        <Route size={22} className="opacity-70" />
        <h2 className="mt-12 max-w-xl text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
          {action?.title ?? "Complete a diagnostic mock"}
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-6 opacity-70">
          {action?.reason ?? "Analytics needs one evaluated attempt before it can rank your next move."}
        </p>
        {exam && (
          <Link href={`/exams/${exam.exam_id}/statistics`} className="mt-7 inline-flex items-center gap-2 text-sm font-semibold">
            Open {exam.exam_title} <ArrowRight size={15} />
          </Link>
        )}
      </div>
      <div className="grid content-between gap-7 bg-surface-raised p-6 sm:p-8">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Why this action</p>
          <p className="mt-3 text-sm leading-6">
            {action
              ? `${action.target_skill_ids.length || 1} focused signal${action.target_skill_ids.length === 1 ? "" : "s"} · ${Math.round(action.confidence * 100)}% evidence confidence`
              : "No personal evidence yet"}
          </p>
        </div>
        <div className="flex items-end justify-between border-t border-line pt-5">
          <div>
            <p className="text-xs text-muted">Priority score</p>
            <p className="mt-1 font-mono text-3xl font-semibold">{action ? action.priority.toFixed(2) : "—"}</p>
          </div>
          <BrainCircuit className="text-signal" />
        </div>
      </div>
    </section>
  );
}

function TrajectoryLedger({ data, compact = false }: { data: AnalyticsOverview; compact?: boolean }) {
  const points = data.recent_trajectory;
  return (
    <section className={`mt-7 rounded-[16px] border border-line p-6 sm:p-8 ${compact ? "lg:grid lg:grid-cols-[250px_1fr] lg:gap-10" : ""}`}>
      <div>
        <BarChart3 size={20} className="text-signal" />
        <h2 className="mt-4 text-lg font-semibold">Recent score trajectory</h2>
        <p className="mt-1 text-xs leading-5 text-muted">Observed scores only. Readiness is calculated separately.</p>
      </div>
      {points.length ? (
        <ol className="mt-8 flex h-44 items-end gap-3 border-b border-line px-2 lg:mt-0" aria-label="Recent scores">
          {points.map((point, index) => (
            <li key={point.attempt_id} className="group flex h-full min-w-12 flex-1 flex-col justify-end text-center">
              <span className="mb-2 font-mono text-[11px] font-semibold">{point.score_percentage}%</span>
              <div className="mx-auto w-full max-w-16 rounded-t-[5px] bg-signal/80 transition group-hover:bg-signal" style={{ height: `${Math.max(7, point.score_percentage)}%` }} />
              <span className="mt-2 truncate text-[9px] text-muted">{index + 1}</span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-8 grid min-h-44 place-items-center rounded-[10px] bg-surface text-center lg:mt-0">
          <div><Sparkles className="mx-auto text-muted" size={18} /><p className="mt-2 text-xs text-muted">Your first result will appear here.</p></div>
        </div>
      )}
    </section>
  );
}

function ExamReadinessRow({ exam }: { exam: AnalyticsOverview["exams"][number] }) {
  const index = exam.readiness.index;
  return (
    <Link href={`/exams/${exam.exam_id}/statistics`} className="group grid gap-5 rounded-[14px] border border-line p-5 transition hover:border-signal/40 hover:bg-surface-raised md:grid-cols-[minmax(180px,1fr)_minmax(220px,1.4fr)_170px_20px] md:items-center">
      <div>
        <p className="font-semibold">{exam.exam_title}</p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted"><CalendarClock size={12} /> {exam.target_date ? new Date(exam.target_date).toLocaleDateString("en-GB") : "No exam date"}</p>
      </div>
      <div>
        <div className="flex justify-between text-[10px] text-muted"><span>readiness</span><span>pass {exam.readiness.pass_threshold}</span></div>
        <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-surface">
          <div className="h-full rounded-full bg-signal" style={{ width: `${index ?? 0}%` }} />
          <span className="absolute inset-y-0 w-px bg-ink/40" style={{ left: `${exam.readiness.pass_threshold}%` }} />
        </div>
        <p className="mt-2 truncate text-[11px] text-muted">{exam.readiness.explanation}</p>
      </div>
      <div className="flex items-end justify-between gap-5 md:justify-end">
        <div><p className="text-[10px] text-muted">index</p><p className="font-mono text-2xl font-semibold">{index ?? "—"}</p></div>
        <div><p className="text-[10px] text-muted">confidence</p><p className="font-mono text-2xl font-semibold">{Math.round(exam.readiness.confidence * 100)}%</p></div>
      </div>
      <ArrowRight size={16} className="hidden text-muted transition group-hover:translate-x-1 group-hover:text-signal md:block" />
    </Link>
  );
}

function HeaderFact({ label, value }: { label: string; value: string }) {
  return <div className="min-w-24 bg-canvas p-4"><p className="text-[10px] text-muted">{label}</p><p className="mt-1 font-mono text-xl font-semibold">{value}</p></div>;
}

function OverviewSkeleton() {
  return <main className="mx-auto max-w-[1240px] animate-pulse px-5 py-10"><div className="h-12 w-80 rounded bg-surface" /><div className="mt-8 h-72 rounded-[16px] bg-surface" /><div className="mt-6 h-56 rounded-[16px] bg-surface" /></main>;
}
