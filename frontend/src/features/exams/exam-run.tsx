"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Clock3,
  Flag,
  Save,
  Send,
  Sparkles,
  Wifi,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/features/demo/demo-provider";
import type { ExamAttempt } from "@/features/exams/types";
import { apiFetch } from "@/lib/api/browser";

type Question = {
  id: string;
  sectionId: string;
  number: number;
  prompt: string;
  points: number;
  type: string;
};
type MockDto = {
  id: string;
  duration_minutes: number;
  max_score: number;
  questions: Array<{
    id: string;
    section_id: string;
    position: number;
    prompt: string;
    points: number;
    question_type: string;
  }>;
};
type AttemptDto = {
  id: string;
  mock_exam: MockDto;
  status: "in_progress" | "evaluated";
  started_at: string;
  responses: Array<{
    question_id: string;
    answer: string;
    flagged: boolean;
    version: number;
  }>;
};
type ResultDto = {
  score: number;
  max_score: number;
  percentage: number;
  duration_seconds: number;
  submitted_at: string;
  feedback: string;
};

export function ExamRun({ examId }: { examId: string }) {
  const { exams, loading, addAttempt } = useDemo();
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const storedExam = exams.find((item) => item.id === examId);
  const [started, setStarted] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<string[]>([]);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [result, setResult] = useState<ExamAttempt | null>(null);
  const [remoteQuestions, setRemoteQuestions] = useState<Question[] | null>(
    null,
  );
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [submitting, setSubmitting] = useState(false);
  const localQuestions = useMemo<Question[]>(
    () =>
      storedExam?.blueprint.flatMap((section, sectionIndex) =>
        Array.from(
          { length: section.questionCount },
          (_, index) => ({
            id: `${section.id}-question-${index + 1}`,
            sectionId: section.id,
            number:
              storedExam.blueprint
                .slice(0, sectionIndex)
                .reduce(
                  (total, item) => total + item.questionCount,
                  0,
                ) +
              index +
              1,
            prompt: questionPrompt(section.title, section.questionType, index),
            points: Math.round(section.points / section.questionCount),
            type: section.questionType,
          }),
        ),
      ) ?? [],
    [storedExam],
  );
  const questions = remoteQuestions ?? localQuestions;

  function hydrateAttempt(attempt: AttemptDto) {
    setAttemptId(attempt.id);
    setRemoteQuestions(
      attempt.mock_exam.questions.map((question) => ({
        id: question.id,
        sectionId: question.section_id,
        number: question.position,
        prompt: question.prompt,
        points: question.points,
        type: question.question_type,
      })),
    );
    setAnswers(
      Object.fromEntries(
        attempt.responses.map((item) => [item.question_id, item.answer]),
      ),
    );
    setFlagged(
      attempt.responses
        .filter((item) => item.flagged)
        .map((item) => item.question_id),
    );
    const elapsed = Math.floor(
      (Date.now() - new Date(attempt.started_at).getTime()) / 1000,
    );
    setSecondsLeft(
      Math.max(0, attempt.mock_exam.duration_minutes * 60 - elapsed),
    );
    setStarted(attempt.status === "in_progress");
  }

  useEffect(() => {
    if (demoMode) return;
    const savedAttempt = window.localStorage.getItem(
      `examtwin.activeAttempt.${examId}`,
    );
    if (!savedAttempt) return;
    void apiFetch<AttemptDto>(`/attempts/${savedAttempt}`)
      .then(hydrateAttempt)
      .catch(() =>
        window.localStorage.removeItem(`examtwin.activeAttempt.${examId}`),
      );
  }, [demoMode, examId]);

  useEffect(() => {
    if (!started || result || secondsLeft <= 0) return;
    const timer = window.setInterval(
      () => setSecondsLeft((current) => Math.max(0, current - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [result, secondsLeft, started]);

  useEffect(() => {
    if (demoMode || !attemptId || !started) return;
    const timer = window.setTimeout(() => {
      setSaveState("saving");
      void Promise.all(
        Object.entries(answers).map(([questionId, answer]) =>
          apiFetch(`/attempts/${attemptId}/responses/${questionId}`, {
            method: "PUT",
            body: JSON.stringify({
              answer,
              flagged: flagged.includes(questionId),
            }),
          }),
        ),
      )
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [answers, attemptId, demoMode, flagged, started]);

  if (loading)
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-muted">
        Loading exam…
      </div>
    );
  if (!storedExam)
    return (
      <div className="grid min-h-dvh place-items-center text-center">
        <div>
          <p className="font-semibold">Exam not found</p>
          <Link
            href="/exams"
            className="mt-4 inline-flex text-sm font-semibold text-signal"
          >
            Return to exams
          </Link>
        </div>
      </div>
    );
  const exam = storedExam;

  async function begin() {
    setGenerating(true);
    setError(null);
    if (!demoMode) {
      try {
        const mock = await apiFetch<MockDto>(`/exams/${exam.id}/mocks`, {
          method: "POST",
          headers: { "Idempotency-Key": crypto.randomUUID() },
        });
        const attempt = await apiFetch<AttemptDto>(
          `/mocks/${mock.id}/attempts`,
          {
            method: "POST",
            headers: { "Idempotency-Key": crypto.randomUUID() },
          },
        );
        window.localStorage.setItem(
          `examtwin.activeAttempt.${exam.id}`,
          attempt.id,
        );
        hydrateAttempt(attempt);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to start this mock.",
        );
      } finally {
        setGenerating(false);
      }
      return;
    }
    window.setTimeout(() => {
      setSecondsLeft(exam.rules.durationMinutes * 60);
      setGenerating(false);
      setStarted(true);
    }, 1100);
  }

  async function submit() {
    if (submitting) return;
    if (!demoMode && attemptId) {
      setSubmitting(true);
      setError(null);
      try {
        const saved = await apiFetch<ResultDto>(
          `/attempts/${attemptId}/submit`,
          { method: "POST", headers: { "Idempotency-Key": attemptId } },
        );
        const attempt: ExamAttempt = {
          id: attemptId,
          examId: exam.id,
          score: saved.score,
          maxScore: saved.max_score,
          durationMinutes: Math.max(1, Math.ceil(saved.duration_seconds / 60)),
          completedAt: new Date(saved.submitted_at).toLocaleString("en-GB"),
          feedback: saved.feedback,
          answers,
        };
        window.localStorage.removeItem(`examtwin.activeAttempt.${exam.id}`);
        setResult(attempt);
        setConfirmSubmit(false);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to submit this attempt.",
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }
    const answered = questions.filter((question) =>
      answers[question.id]?.trim(),
    ).length;
    const completion = questions.length ? answered / questions.length : 0;
    const score = Math.round(
      exam.rules.totalPoints * Math.min(0.92, completion * 0.78),
    );
    const attempt: ExamAttempt = {
      id: `${exam.id}-attempt-${Date.now().toString(36)}`,
      examId: exam.id,
      score,
      maxScore: exam.rules.totalPoints,
      durationMinutes: Math.max(
        1,
        exam.rules.durationMinutes - Math.ceil(secondsLeft / 60),
      ),
      completedAt: new Date().toLocaleString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      feedback:
        answered === questions.length
          ? "All visible questions were completed. Review the detailed rubric feedback when evaluation finishes."
          : `${questions.length - answered} questions were left unanswered. Focus first on completion and time allocation.`,
      answers,
    };
    void addAttempt(exam.id, attempt);
    setResult(attempt);
    setConfirmSubmit(false);
  }

  if (!started)
    return (
      <div className="min-h-dvh bg-surface-raised text-ink">
        <header className="flex h-16 items-center border-b border-line bg-canvas px-5 sm:px-8">
          <Brand />
          <Link
            href={`/exams/${exam.id}`}
            className="ml-auto inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink"
          >
            <ArrowLeft size={15} /> Back to Exam
          </Link>
        </header>
        <main className="mx-auto grid min-h-[calc(100dvh-64px)] max-w-[920px] place-items-center px-4 py-12">
          <div className="w-full rounded-[18px] border border-line bg-canvas p-6 shadow-float sm:p-10">
            <div className="flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-[12px] bg-signal-soft text-signal">
                <Sparkles size={22} />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                  Mock generation
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                  {exam.title}
                </h1>
                <p className="mt-2 text-sm leading-6 text-muted">
                  A fresh simulation will follow the verified blueprint,
                  attached data, scenario, and rules.
                </p>
              </div>
            </div>
            <div className="mt-8 grid gap-px overflow-hidden rounded-[12px] border border-line bg-line sm:grid-cols-4">
              <Fact label="Parts" value={String(exam.blueprint.length)} />
              <Fact label="Questions" value={String(questions.length)} />
              <Fact label="Time" value={`${exam.rules.durationMinutes} min`} />
              <Fact label="Points" value={String(exam.rules.totalPoints)} />
            </div>
            <div className="mt-7 rounded-[11px] bg-surface p-4">
              <p className="text-sm font-semibold">Before you start</p>
              <ul className="mt-3 grid gap-2 text-xs leading-5 text-muted">
                <li>Allowed materials: {exam.rules.allowedMaterials}</li>
                <li>
                  Pass mark: {exam.rules.passPercentage}% · {exam.rules.penalty}
                </li>
                <li>
                  Your answers autosave {demoMode ? "in this browser" : "to your account"} during the attempt.
                </li>
              </ul>
            </div>
            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 text-xs text-muted">
                <AlertTriangle size={14} /> AI evaluation is study guidance, not
                an official grade.
              </p>
              <Button onClick={begin} disabled={generating}>
                {generating ? "Generating mock…" : "Generate and start"}
                <ArrowRight size={16} />
              </Button>
            </div>
            {error && <p className="mt-3 text-right text-xs text-danger" role="alert">{error}</p>}
          </div>
        </main>
      </div>
    );

  if (result)
    return (
      <div className="min-h-dvh bg-surface-raised text-ink">
        <header className="flex h-16 items-center border-b border-line bg-canvas px-5 sm:px-8">
          <Brand />
        </header>
        <main className="mx-auto max-w-[900px] px-4 py-12 sm:py-20">
          <div className="rounded-[18px] border border-line bg-canvas p-6 sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-success">
              Attempt saved
            </p>
            <div className="mt-4 flex flex-col gap-6 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-3xl font-semibold tracking-[-0.04em]">
                  Simulation complete
                </h1>
                <p className="mt-2 text-sm text-muted">
                  The result and feedback are now in this Exam’s history.
                </p>
              </div>
              <p className="font-mono text-5xl font-semibold tracking-[-0.06em]">
                {Math.round((result.score / result.maxScore) * 100)}%
              </p>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <Fact
                label="Score"
                value={`${result.score}/${result.maxScore}`}
              />
              <Fact label="Time used" value={`${result.durationMinutes} min`} />
              <Fact
                label="Answered"
                value={`${Object.values(result.answers).filter(Boolean).length}/${questions.length}`}
              />
            </div>
            <div className="mt-7 rounded-[12px] bg-surface p-5">
              <p className="text-sm font-semibold">Initial feedback</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                {result.feedback}
              </p>
            </div>
            <div className="mt-8 flex flex-wrap justify-end gap-2">
              <Link
                href={`/exams/${exam.id}?tab=history`}
                className="inline-flex min-h-10 items-center gap-2 rounded-[9px] border border-line bg-white px-4 text-sm font-semibold hover:bg-surface"
              >
                View history
              </Link>
              <Link
                href={`/exams/${exam.id}/statistics`}
                className="inline-flex min-h-10 items-center gap-2 rounded-[9px] bg-signal px-4 text-sm font-semibold text-white"
              >
                Open statistics <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </main>
      </div>
    );

  const activeQuestion = questions[activeIndex];
  const currentSection = exam.blueprint.find(
    (section) => section.id === activeQuestion?.sectionId,
  );
  const answeredCount = Object.values(answers).filter((answer) =>
    answer.trim(),
  ).length;
  const minutes = Math.floor(secondsLeft / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (secondsLeft % 60).toString().padStart(2, "0");

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <header className="sticky top-0 z-20 flex h-16 items-center border-b border-line bg-canvas/95 px-4 backdrop-blur-xl sm:px-6">
        <div className="hidden sm:block">
          <Brand />
        </div>
        <div className="min-w-0 sm:ml-8">
          <p className="truncate text-sm font-semibold">{exam.title}</p>
          <p className="text-[11px] text-muted">{currentSection?.title}</p>
        </div>
        <div
          className={`ml-auto flex items-center gap-2 rounded-[9px] px-3 py-2 font-mono text-sm font-semibold ${secondsLeft < 300 ? "bg-red-50 text-danger" : "bg-surface"}`}
        >
          <Clock3 size={15} /> {minutes}:{seconds}
        </div>
        <span className="ml-3 hidden items-center gap-1.5 text-[11px] text-muted sm:flex">
          <Wifi size={13} className="text-success" /> Online
        </span>
      </header>
      <div className="grid min-h-[calc(100dvh-64px)] lg:grid-cols-[240px_minmax(0,1fr)_260px]">
        <aside className="hidden border-r border-line bg-surface-raised p-4 lg:block">
          <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Questions
          </p>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {questions.map((question, index) => (
              <button
                key={question.id}
                onClick={() => setActiveIndex(index)}
                className={`relative grid aspect-square place-items-center rounded-[8px] border text-xs font-semibold ${index === activeIndex ? "border-signal bg-signal text-white" : answers[question.id]?.trim() ? "border-success/30 bg-emerald-50 text-success" : "border-line bg-white"}`}
              >
                {question.number}
                {flagged.includes(question.id) && (
                  <span className="absolute -right-1 -top-1 size-2 rounded-full bg-warning" />
                )}
              </button>
            ))}
          </div>
          <div className="mt-6 border-t border-line pt-4 text-xs text-muted">
            <p>
              {answeredCount} of {questions.length} answered
            </p>
            <div className="mt-2 h-1 rounded-full bg-line">
              <div
                className="h-full rounded-full bg-signal"
                style={{
                  width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </aside>
        <main className="mx-auto w-full max-w-[820px] px-4 py-8 sm:px-8 sm:py-12">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Question {activeQuestion.number} of {questions.length}
            </p>
            <button
              onClick={() =>
                setFlagged((current) =>
                  current.includes(activeQuestion.id)
                    ? current.filter((id) => id !== activeQuestion.id)
                    : [...current, activeQuestion.id],
                )
              }
              className={`inline-flex min-h-9 items-center gap-2 rounded-[8px] px-3 text-xs font-semibold ${flagged.includes(activeQuestion.id) ? "bg-amber-50 text-warning" : "text-muted hover:bg-surface"}`}
            >
              <Flag
                size={14}
                fill={
                  flagged.includes(activeQuestion.id) ? "currentColor" : "none"
                }
              />{" "}
              {flagged.includes(activeQuestion.id)
                ? "Flagged"
                : "Flag for review"}
            </button>
          </div>
          <h1 className="mt-7 text-xl font-semibold leading-8 tracking-[-0.02em] sm:text-2xl">
            {activeQuestion.prompt}
          </h1>
          <div className="mt-3 flex items-center gap-3 text-xs text-muted">
            <span>{activeQuestion.type}</span>
            <span>·</span>
            <span>{activeQuestion.points} points</span>
          </div>
          <textarea
            value={answers[activeQuestion.id] ?? ""}
            onChange={(event) =>
              setAnswers((current) => ({
                ...current,
                [activeQuestion.id]: event.target.value,
              }))
            }
            rows={12}
            placeholder="Write your answer and show your reasoning…"
            className="mt-8 w-full resize-y rounded-[12px] border border-line bg-white p-4 text-[15px] leading-7 shadow-[inset_0_1px_2px_rgba(13,13,13,0.025)] focus:border-signal focus:outline-hidden"
            autoFocus
          />
            <p className={`mt-3 flex items-center gap-2 text-[11px] ${saveState === "error" ? "text-danger" : "text-muted"}`} aria-live="polite">
              <Save size={13} className={saveState === "error" ? "text-danger" : "text-success"} />
              {demoMode ? "Saved in this browser" : saveState === "saving" ? "Saving…" : saveState === "error" ? "Autosave failed — your answer is still on screen" : "Saved to your account"}
          </p>
          <div className="mt-8 flex items-center justify-between border-t border-line pt-6">
            <Button
              variant="secondary"
              onClick={() =>
                setActiveIndex((current) => Math.max(0, current - 1))
              }
              disabled={activeIndex === 0}
            >
              <ArrowLeft size={15} /> Previous
            </Button>
            {activeIndex < questions.length - 1 ? (
              <Button
                onClick={() =>
                  setActiveIndex((current) =>
                    Math.min(questions.length - 1, current + 1),
                  )
                }
              >
                Next <ArrowRight size={15} />
              </Button>
            ) : (
              <Button onClick={() => setConfirmSubmit(true)}>
                <Send size={15} /> Submit exam
              </Button>
            )}
          </div>
        </main>
        <aside className="hidden border-l border-line p-5 xl:block">
          <p className="text-sm font-semibold">Exam rules</p>
          <dl className="mt-5 grid gap-4 text-xs">
            <div>
              <dt className="text-muted">Allowed materials</dt>
              <dd className="mt-1 font-medium leading-5">
                {exam.rules.allowedMaterials}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Pass mark</dt>
              <dd className="mt-1 font-medium">{exam.rules.passPercentage}%</dd>
            </div>
            <div>
              <dt className="text-muted">Penalty</dt>
              <dd className="mt-1 font-medium leading-5">
                {exam.rules.penalty}
              </dd>
            </div>
          </dl>
          <p className="mt-6 border-t border-line pt-5 text-[11px] leading-5 text-muted">
            {exam.rules.gradingNotes}
          </p>
        </aside>
      </div>
      {confirmSubmit && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-[2px]"
          onClick={() => setConfirmSubmit(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-title"
            className="w-full max-w-[440px] rounded-[14px] bg-white p-6 shadow-float"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="submit-title" className="text-lg font-semibold">
              Submit this attempt?
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              You answered {answeredCount} of {questions.length} questions.
              Submission ends the simulation and saves the result to History.
            </p>
            {answeredCount < questions.length && (
              <p className="mt-4 rounded-[9px] bg-amber-50 p-3 text-xs text-warning">
                {questions.length - answeredCount} questions are still
                unanswered.
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setConfirmSubmit(false)}
              >
                Keep working
              </Button>
              <Button onClick={submit} disabled={submitting}>{submitting ? "Submitting…" : "Submit attempt"}</Button>
            </div>
            {error && <p className="mt-3 text-right text-xs text-danger" role="alert">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-canvas p-4 text-center">
      <p className="font-mono text-xl font-semibold">{value}</p>
      <p className="mt-1 text-[11px] text-muted">{label}</p>
    </div>
  );
}

function questionPrompt(section: string, type: string, variant: number) {
  const prompts = [
    `Using the provided course context, solve a representative ${type.toLowerCase()} task from “${section}”. State your assumptions and show each important step.`,
    `A source-grounded problem tests the most important skill in “${section}”. Explain your method, calculate or justify the result, and note any constraints.`,
  ];
  return prompts[variant % prompts.length];
}
