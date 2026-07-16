"use client";

import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  Clock3,
  FileText,
  History,
  Pencil,
  Play,
  Settings2,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { ArtifactManager } from "@/features/artifacts/artifact-manager";
import { useDemo } from "@/features/demo/demo-provider";

const tabs = ["Data", "Blueprint", "Scenario", "Rules", "History"] as const;
type Tab = (typeof tabs)[number];

export function ExamDetail({
  examId,
  initialTab = "Data",
  uploadPartial = false,
}: {
  examId: string;
  initialTab?: Tab;
  uploadPartial?: boolean;
}) {
  const router = useRouter();
  const { exams, subjects, loading, removeExam, refreshExamArtifacts } = useDemo();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const exam = exams.find((item) => item.id === examId);
  const subject = subjects.find((item) => item.id === exam?.subjectId);

  if (loading)
    return (
      <div className="grid min-h-[70dvh] place-items-center text-sm text-muted">
        Loading exam…
      </div>
    );
  if (!exam)
    return (
      <div className="grid min-h-[70dvh] place-items-center px-5 text-center">
        <div>
          <p className="text-lg font-semibold">Exam not found</p>
          <p className="mt-2 text-sm text-muted">
            It may have been deleted or you may not have access.
          </p>
          <Link
            href="/exams"
            className="mt-5 inline-flex text-sm font-semibold text-signal"
          >
            Return to exams
          </Link>
        </div>
      </div>
    );

  const examSubjectId = exam.subjectId;
  const totalQuestions = exam.blueprint.reduce(
    (total, section) => total + section.questionCount,
    0,
  );
  const latestAttempt = exam.attempts[0];

  async function remove() {
    await removeExam(examId);
    router.push(`/subjects/${examSubjectId}`);
  }

  return (
    <div className="page-enter mx-auto w-full max-w-[1280px] px-4 py-7 sm:px-7 sm:py-9 xl:px-10">
      <Link
        href={`/subjects/${exam.subjectId}`}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft size={16} /> {subject?.title ?? "Subject"}
      </Link>
      <header className="flex flex-col gap-6 border-b border-line pb-7 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={exam.status === "ready" ? "success" : "warning"}>
              {exam.status}
            </StatusPill>
            <span className="text-xs text-muted">
              {exam.examType} · Updated {exam.updatedAt.toLowerCase()}
            </span>
          </div>
          <h1 className="mt-3 text-[34px] font-semibold tracking-[-0.045em] sm:text-[42px]">
            {exam.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            {exam.description || "No description yet."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/exams/${exam.id}/edit`}
            className="inline-flex min-h-10 items-center gap-2 rounded-[9px] border border-line bg-white px-4 text-sm font-semibold hover:bg-surface"
          >
            <Pencil size={15} /> Edit exam
          </Link>
          <Link
            href={`/exams/${exam.id}/statistics`}
            className="inline-flex min-h-10 items-center gap-2 rounded-[9px] border border-line bg-white px-4 text-sm font-semibold hover:bg-surface"
          >
            <BarChart3 size={15} /> Statistics
          </Link>
          {exam.status === "ready" ? (
            <Link
              href={`/exams/${exam.id}/run`}
              className="inline-flex min-h-10 items-center gap-2 rounded-[9px] bg-signal px-4 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(46,46,255,0.18)]"
            >
              <Play size={15} fill="currentColor" /> Generate & run mock
            </Link>
          ) : (
            <button
              disabled
              className="inline-flex min-h-10 cursor-not-allowed items-center gap-2 rounded-[9px] bg-surface px-4 text-sm font-semibold text-muted"
            >
              <Play size={15} /> Complete setup to run
            </button>
          )}
        </div>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[12px] border border-line p-4">
          <p className="text-[11px] text-muted">Target date</p>
          <p className="mt-2 flex items-center gap-2 text-sm font-semibold">
            <CalendarDays size={15} />{" "}
            {exam.targetDate
              ? new Date(`${exam.targetDate}T00:00:00`).toLocaleDateString(
                  "en-GB",
                  { day: "numeric", month: "long", year: "numeric" },
                )
              : "Not set"}
          </p>
        </div>
        <div className="rounded-[12px] border border-line p-4">
          <p className="text-[11px] text-muted">Duration</p>
          <p className="mt-2 flex items-center gap-2 text-sm font-semibold">
            <Clock3 size={15} /> {exam.rules.durationMinutes} minutes
          </p>
        </div>
        <div className="rounded-[12px] border border-line p-4">
          <p className="text-[11px] text-muted">Blueprint</p>
          <p className="mt-2 text-sm font-semibold">
            {exam.blueprint.length} parts · {totalQuestions} questions
          </p>
        </div>
        <div className="rounded-[12px] border border-line p-4">
          <p className="text-[11px] text-muted">Latest result</p>
          <p className="mt-2 font-mono text-xl font-semibold">
            {latestAttempt
              ? `${Math.round((latestAttempt.score / latestAttempt.maxScore) * 100)}%`
              : "—"}
          </p>
        </div>
      </section>

      <div className="mt-7 overflow-x-auto border-b border-line">
        <nav className="flex min-w-max gap-1" aria-label="Exam workspace">
          {tabs.map((item) => {
            const icons = {
              Data: FileText,
              Blueprint: BookOpen,
              Scenario: Sparkles,
              Rules: Settings2,
              History,
            };
            const Icon = icons[item];
            return (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={`relative flex min-h-11 items-center gap-2 px-4 text-sm font-medium ${tab === item ? "text-ink" : "text-muted hover:text-ink"}`}
              >
                <Icon size={15} /> {item}
                {tab === item && (
                  <span className="absolute inset-x-3 bottom-0 h-0.5 bg-signal" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <section className="min-h-[360px] py-7">
        {tab === "Data" && (
          process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? <div>
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Context data</h2>
                <p className="mt-1 text-sm text-muted">
                  Files and notes used for blueprint extraction, generation, and
                  evaluation.
                </p>
              </div>
              <Link
                href={`/exams/${exam.id}/edit`}
                className="text-sm font-semibold text-signal"
              >
                Manage data
              </Link>
            </div>
            {exam.sources.length ? (
              <div className="divide-y divide-line rounded-[13px] border border-line">
                {exam.sources.map((source) => (
                  <div key={source.id} className="flex items-center gap-4 p-4">
                    <span className="grid size-10 place-items-center rounded-[10px] bg-surface text-muted">
                      <FileText size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {source.name}
                      </p>
                      <p className="mt-1 text-xs capitalize text-muted">
                        {source.kind.replace("_", " ")} · {source.size}
                      </p>
                    </div>
                    <StatusPill
                      tone={source.status === "ready" ? "success" : "warning"}
                    >
                      {source.status.replace("_", " ")}
                    </StatusPill>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title="No context data"
                text="Add at least one source before generating a grounded mock."
                actionHref={`/exams/${exam.id}/edit`}
                action="Add data"
              />
            )}
          </div> : <ArtifactManager examId={exam.id} onMutation={() => refreshExamArtifacts(exam.id)} initialNotice={uploadPartial ? "The Exam was saved, but one or more files did not finish uploading. Review the interrupted items below and add those files again." : undefined} />
        )}

        {tab === "Blueprint" && (
          <div>
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">
                  Verified exam blueprint
                </h2>
                <p className="mt-1 text-sm text-muted">
                  The ordered structure every generated mock must follow.
                </p>
              </div>
              <Link
                href={`/exams/${exam.id}/edit`}
                className="text-sm font-semibold text-signal"
              >
                Edit blueprint
              </Link>
            </div>
            {exam.blueprint.length ? (
              <div className="overflow-hidden rounded-[14px] border border-line">
                <div className="grid md:grid-cols-3">
                  {exam.blueprint.map((section, index) => (
                    <div
                      key={section.id}
                      className={`relative p-5 ${index < exam.blueprint.length - 1 ? "border-b border-line md:border-b-0 md:border-r" : ""}`}
                    >
                      <div className="mb-8 flex items-start justify-between">
                        <span className="grid size-8 place-items-center rounded-full bg-contrast text-contrast-ink">
                          <Check size={14} />
                        </span>
                        <span className="font-mono text-[11px] text-muted">
                          {Math.round(
                            (section.points /
                              Math.max(1, exam.rules.totalPoints)) *
                              100,
                          )}
                          %
                        </span>
                      </div>
                      <p className="text-sm font-semibold">{section.title}</p>
                      <p className="mt-1 text-xs text-muted">
                        {section.questionCount} × {section.questionType}
                      </p>
                      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted">
                        <Clock3 size={13} /> {section.durationMinutes} min ·{" "}
                        {section.points} pts
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <Empty
                title="Blueprint is empty"
                text="Define the parts, timing, question types, and scoring before generation."
                actionHref={`/exams/${exam.id}/edit`}
                action="Build blueprint"
              />
            )}
          </div>
        )}

        {tab === "Scenario" && (
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="rounded-[13px] border border-line p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-[10px] bg-signal-soft text-signal">
                  <Sparkles size={18} />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-[0.1em] text-muted">
                    Generation mode
                  </p>
                  <p className="mt-1 text-lg font-semibold capitalize">
                    {exam.scenario.mode.replace("_", " ")}
                  </p>
                </div>
              </div>
              <div className="mt-6 border-t border-line pt-5">
                <p className="text-xs font-semibold text-muted">
                  Instructions for the model
                </p>
                <p className="mt-2 text-sm leading-6">
                  {exam.scenario.instructions}
                </p>
              </div>
            </div>
            <div className="rounded-[13px] border border-line bg-surface-raised p-5">
              <p className="text-sm font-semibold">Generation contract</p>
              <ul className="mt-4 grid gap-3 text-xs leading-5 text-muted">
                <li className="flex gap-2">
                  <Check size={14} className="mt-0.5 shrink-0 text-success" />{" "}
                  Follow all blueprint weights and timing.
                </li>
                <li className="flex gap-2">
                  <Check size={14} className="mt-0.5 shrink-0 text-success" />{" "}
                  Ground questions in attached data.
                </li>
                <li className="flex gap-2">
                  <Check size={14} className="mt-0.5 shrink-0 text-success" />{" "}
                  Hide answer keys until submission.
                </li>
              </ul>
              <p className="mt-5 border-t border-line pt-4 text-xs text-muted">
                Difficulty:{" "}
                <strong className="font-semibold capitalize text-ink">
                  {exam.scenario.difficulty}
                </strong>
              </p>
            </div>
          </div>
        )}

        {tab === "Rules" && (
          <div className="grid gap-4 md:grid-cols-2">
            <Rule
              label="Time limit"
              value={`${exam.rules.durationMinutes} minutes`}
            />
            <Rule
              label="Total points"
              value={`${exam.rules.totalPoints} points`}
            />
            <Rule label="Pass mark" value={`${exam.rules.passPercentage}%`} />
            <Rule label="Penalties" value={exam.rules.penalty} />
            <Rule
              label="Allowed materials"
              value={exam.rules.allowedMaterials}
            />
            <Rule label="Grading notes" value={exam.rules.gradingNotes} />
          </div>
        )}

        {tab === "History" && (
          <div>
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Attempt archive</h2>
                <p className="mt-1 text-sm text-muted">
                  Every completed simulation, result, and feedback snapshot.
                </p>
              </div>
              {exam.status === "ready" && (
                <Link
                  href={`/exams/${exam.id}/run`}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-signal"
                >
                  <Play size={14} /> New mock
                </Link>
              )}
            </div>
            {exam.attempts.length ? (
              <div className="divide-y divide-line rounded-[13px] border border-line">
                {exam.attempts.map((attempt) => (
                  <div
                    key={attempt.id}
                    className="grid gap-4 p-4 sm:grid-cols-[120px_1fr_auto] sm:items-center"
                  >
                    <div>
                      <p className="font-mono text-2xl font-semibold">
                        {Math.round((attempt.score / attempt.maxScore) * 100)}%
                      </p>
                      <p className="text-[11px] text-muted">
                        {attempt.score}/{attempt.maxScore} points
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {attempt.completedAt}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted">
                        {attempt.feedback}
                      </p>
                    </div>
                    <span className="text-xs text-muted">
                      {attempt.durationMinutes} min
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title="No attempts yet"
                text="Generate and complete a mock to start building this Exam's history."
                actionHref={`/exams/${exam.id}/run`}
                action="Run first mock"
              />
            )}
          </div>
        )}
      </section>

      <section className="border-t border-line pt-7">
        <p className="text-sm font-semibold">Danger zone</p>
        <p className="mt-1 text-xs text-muted">
          Deleting this Exam removes its data, blueprint, rules, mocks,
          attempts, and statistics.
        </p>
        <Button
          variant="danger"
          className="mt-4"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 size={15} /> Delete exam
        </Button>
      </section>
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-[2px]"
          onClick={() => setConfirmDelete(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-exam-title"
            className="w-full max-w-[440px] rounded-[14px] bg-white p-6 shadow-float"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="delete-exam-title" className="text-lg font-semibold">
              Delete {exam.title}?
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              This removes {exam.sources.length} sources, the blueprint, and{" "}
              {exam.attempts.length} attempts. The Subject category remains.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={remove}>
                Delete exam
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-line p-5">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold leading-6">
        {value || "Not specified"}
      </p>
    </div>
  );
}

function Empty({
  title,
  text,
  actionHref,
  action,
}: {
  title: string;
  text: string;
  actionHref: string;
  action: string;
}) {
  return (
    <div className="grid min-h-[220px] place-items-center rounded-[13px] border border-dashed border-line p-6 text-center">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-2 text-xs text-muted">{text}</p>
        <Link
          href={actionHref}
          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-signal"
        >
          {action} <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
