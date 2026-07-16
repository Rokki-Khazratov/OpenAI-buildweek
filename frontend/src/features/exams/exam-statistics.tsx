"use client";

import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Clock3,
  History,
  Info,
  Play,
  RefreshCw,
  Target,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { useDemo } from "@/features/demo/demo-provider";
import { ApiError } from "@/lib/api/browser";

import { getExamStatistics, listExamAttempts } from "./api";
import {
  statisticsViewFromApi,
  statisticsViewFromDemoAttempts,
  type ExamStatisticsView,
} from "./statistics-model";

type RemoteState =
  | { status: "loading" }
  | { status: "ready"; view: ExamStatisticsView }
  | { status: "unavailable" }
  | { status: "error"; message: string };

export function ExamStatistics({ examId }: { examId: string }) {
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const { exams, loading: workspaceLoading } = useDemo();
  const exam = exams.find((item) => item.id === examId);
  const [remote, setRemote] = useState<RemoteState>({ status: "loading" });

  const load = useCallback(async () => {
    setRemote({ status: "loading" });
    try {
      const [statistics, attempts] = await Promise.all([
        getExamStatistics(examId),
        listExamAttempts(examId),
      ]);
      setRemote({ status: "ready", view: statisticsViewFromApi(statistics, attempts) });
    } catch (reason) {
      if (reason instanceof ApiError && [401, 403, 404].includes(reason.status)) {
        setRemote({ status: "unavailable" });
        return;
      }
      setRemote({
        status: "error",
        message:
          reason instanceof Error ? reason.message : "Statistics could not be loaded right now.",
      });
    }
  }, [examId]);

  useEffect(() => {
    if (demoMode) return;
    let active = true;

    void Promise.all([getExamStatistics(examId), listExamAttempts(examId)])
      .then(([statistics, attempts]) => {
        if (active) {
          setRemote({ status: "ready", view: statisticsViewFromApi(statistics, attempts) });
        }
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (reason instanceof ApiError && [401, 403, 404].includes(reason.status)) {
          setRemote({ status: "unavailable" });
          return;
        }
        setRemote({
          status: "error",
          message:
            reason instanceof Error ? reason.message : "Statistics could not be loaded right now.",
        });
      });

    return () => {
      active = false;
    };
  }, [demoMode, examId]);

  if (demoMode) {
    if (workspaceLoading) return <StatisticsSkeleton examId={examId} />;
    if (!exam) return <UnavailableState />;
    return (
      <StatisticsContent
        examId={examId}
        examTitle={exam.title}
        view={statisticsViewFromDemoAttempts(exam.attempts)}
      />
    );
  }

  if (remote.status === "loading") return <StatisticsSkeleton examId={examId} />;
  if (remote.status === "unavailable") return <UnavailableState />;
  if (remote.status === "error")
    return (
      <ErrorState examId={examId} examTitle={exam?.title} message={remote.message} onRetry={load} />
    );
  return <StatisticsContent examId={examId} examTitle={exam?.title} view={remote.view} />;
}

function PageShell({
  examId,
  examTitle,
  children,
}: {
  examId: string;
  examTitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="page-enter mx-auto w-full max-w-[1180px] px-4 py-7 sm:px-7 sm:py-9 xl:px-10">
      <Link
        href={`/exams/${examId}`}
        className="mb-6 inline-flex items-center gap-2 rounded-[7px] text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft size={16} /> {examTitle ?? "Back to Exam"}
      </Link>
      {children}
    </div>
  );
}

function StatisticsContent({
  examId,
  examTitle,
  view,
}: {
  examId: string;
  examTitle?: string;
  view: ExamStatisticsView;
}) {
  return (
    <PageShell examId={examId} examTitle={examTitle}>
      <header className="flex flex-col gap-5 border-b border-line pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={view.lowConfidence ? "warning" : "success"}>
              {view.lowConfidence ? "Low-confidence view" : "Established baseline"}
            </StatusPill>
            <span className="text-xs text-muted">
              {view.attemptCount} completed attempt{view.attemptCount === 1 ? "" : "s"}
            </span>
          </div>
          <h1 className="mt-3 text-[34px] font-semibold tracking-[-0.045em] sm:text-[42px]">
            Exam statistics
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Deterministic aggregates from your completed mock attempts. Mastery, skills, timing,
            and error analysis unlock as real evaluation data accumulates.
          </p>
        </div>
        <Link
          href={`/exams/${examId}/run`}
          className="inline-flex min-h-10 items-center gap-2 self-start rounded-[9px] bg-signal px-4 text-sm font-semibold text-white sm:self-auto"
        >
          <Play size={15} fill="currentColor" /> Run another mock
        </Link>
      </header>

      <section aria-label="Attempt aggregates" className="mt-6 grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <Metric icon={History} label="Completed attempts" value={String(view.attemptCount)} />
        <Metric
          icon={Target}
          label="Latest score"
          value={view.latestPercentage === null ? "—" : `${view.latestPercentage}%`}
        />
        <Metric
          icon={BarChart3}
          label="Average score"
          value={view.averagePercentage === null ? "—" : `${view.averagePercentage}%`}
        />
        <Metric
          icon={Trophy}
          label="Best score"
          value={view.bestPercentage === null ? "—" : `${view.bestPercentage}%`}
        />
        <Metric icon={Clock3} label="Average duration" value={view.averageDurationLabel ?? "—"} />
      </section>

      {view.attemptCount > 0 && view.lowConfidence && (
        <div className="mt-6 flex gap-3 rounded-[12px] border border-line bg-surface-raised p-4">
          <Info size={18} className="mt-0.5 shrink-0 text-signal" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">
              {view.attemptCount === 1 ? "Single attempt — early signal only" : "Low-confidence view"}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">
              Complete {5 - view.attemptCount} more attempt{5 - view.attemptCount === 1 ? "" : "s"}{" "}
              before treating trends as reliable. Scores remain visible, but ExamTwin will not
              overstate mastery from sparse evidence.
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <section className="rounded-[14px] border border-line p-5 sm:p-6" aria-label="Score history">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Score trajectory</h2>
              <p className="mt-1 text-xs text-muted">
                Completed simulations in chronological order.
              </p>
            </div>
            {view.history.length > 0 && (
              <Link
                href={`/exams/${examId}?tab=history`}
                className="inline-flex items-center gap-1 rounded-[7px] text-xs font-semibold text-signal"
              >
                View attempt history <ArrowRight size={13} />
              </Link>
            )}
          </div>
          {view.history.length ? (
            <>
              <ol
                className="mt-8 flex h-52 items-end gap-4 overflow-x-auto border-b border-line px-3"
                aria-label="Scores per attempt, oldest first"
              >
                {view.history.map((point, index) => (
                  <li
                    key={point.id}
                    className="flex h-full min-w-10 flex-1 flex-col justify-end text-center"
                  >
                    <span className="mb-2 font-mono text-xs font-semibold">{point.percentage}%</span>
                    <div
                      aria-hidden="true"
                      className="mx-auto w-full max-w-14 rounded-t-[7px] bg-signal transition"
                      style={{ height: `${Math.max(8, Math.min(100, point.percentage))}%` }}
                    />
                    <span className="mt-2 text-[10px] text-muted">#{index + 1}</span>
                    <span className="sr-only">
                      {point.scoreLabel}, {point.durationLabel}, completed {point.completedAtLabel}
                    </span>
                  </li>
                ))}
              </ol>
              <ul className="mt-4 grid gap-2" aria-label="Recent attempts, latest first">
                {[...view.history]
                  .reverse()
                  .slice(0, 3)
                  .map((point) => (
                    <li
                      key={point.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-[9px] bg-surface p-3 text-xs"
                    >
                      <span className="font-mono text-sm font-semibold">{point.percentage}%</span>
                      <span className="text-muted">{point.scoreLabel}</span>
                      <span className="text-muted">{point.durationLabel}</span>
                      <span className="text-muted">{point.completedAtLabel}</span>
                    </li>
                  ))}
              </ul>
            </>
          ) : (
            <EmptyStats examId={examId} />
          )}
        </section>
        <section className="rounded-[14px] border border-line p-5 sm:p-6" aria-label="Analysis roadmap">
          <h2 className="text-sm font-semibold">Analysis roadmap</h2>
          <p className="mt-1 text-xs text-muted">
            This page is ready for the real evaluation contract.
          </p>
          <ul className="mt-5 grid gap-3">
            {[
              "Blueprint part mastery",
              "Skill evidence and confidence",
              "Time allocation",
              "Error types",
              "Adaptive next mock",
            ].map((item) => (
              <li
                key={item}
                className="flex items-center justify-between rounded-[9px] bg-surface p-3 text-sm"
              >
                <span>{item}</span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Soon
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PageShell>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Target;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[13px] border border-line p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">{label}</p>
        <Icon size={16} className="text-muted" aria-hidden="true" />
      </div>
      <p className="mt-4 font-mono text-3xl font-semibold tracking-[-0.04em]">{value}</p>
    </div>
  );
}

function EmptyStats({ examId }: { examId: string }) {
  return (
    <div className="grid min-h-52 place-items-center text-center">
      <div>
        <BarChart3 size={22} className="mx-auto text-muted" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold">No results yet</p>
        <p className="mt-1 text-xs text-muted">Complete a mock to create the first observation.</p>
        <Link
          href={`/exams/${examId}/run`}
          className="mt-4 inline-flex items-center gap-1 rounded-[7px] text-sm font-semibold text-signal"
        >
          Run first mock <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

function StatisticsSkeleton({ examId }: { examId: string }) {
  return (
    <PageShell examId={examId}>
      <div role="status" aria-label="Loading statistics" className="animate-pulse">
        <div className="border-b border-line pb-7">
          <div className="h-6 w-40 rounded-full bg-surface" />
          <div className="mt-4 h-10 w-72 rounded-[9px] bg-surface" />
          <div className="mt-3 h-4 w-full max-w-xl rounded-[7px] bg-surface" />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="h-28 rounded-[13px] border border-line bg-surface" />
          ))}
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <div className="h-80 rounded-[14px] border border-line bg-surface" />
          <div className="h-80 rounded-[14px] border border-line bg-surface" />
        </div>
        <span className="sr-only">Loading statistics…</span>
      </div>
    </PageShell>
  );
}

function UnavailableState() {
  return (
    <div className="grid min-h-[70dvh] place-items-center px-5 text-center">
      <div>
        <p className="text-lg font-semibold">Statistics unavailable</p>
        <p className="mt-2 text-sm text-muted">
          This Exam may have been deleted, or you may not have access to it.
        </p>
        <Link href="/exams" className="mt-5 inline-flex rounded-[7px] text-sm font-semibold text-signal">
          Return to exams
        </Link>
      </div>
    </div>
  );
}

function ErrorState({
  examId,
  examTitle,
  message,
  onRetry,
}: {
  examId: string;
  examTitle?: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <PageShell examId={examId} examTitle={examTitle}>
      <div
        role="alert"
        className="mx-auto mt-10 w-full max-w-[520px] rounded-[14px] border border-line bg-surface-raised p-8 text-center"
      >
        <p className="text-lg font-semibold">Statistics could not be loaded</p>
        <p className="mt-2 text-sm leading-6 text-muted">{message}</p>
        <Button className="mt-6" onClick={onRetry}>
          <RefreshCw size={15} /> Retry
        </Button>
      </div>
    </PageShell>
  );
}
