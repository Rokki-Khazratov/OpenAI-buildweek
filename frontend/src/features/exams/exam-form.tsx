"use client";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  FileText,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { uploadArtifact } from "@/features/artifacts/api";
import { useDemo } from "@/features/demo/demo-provider";
import type {
  BlueprintSection,
  Exam,
  ExamInput,
  ExamLanguage,
  ExamSource,
  MockMode,
  SourceKind,
} from "@/features/exams/types";

const steps = [
  "Basics",
  "Data",
  "Blueprint",
  "Scenario & rules",
  "Review",
] as const;
const sourceLabels: Record<SourceKind, string> = {
  past_exam: "Past exam",
  rubric: "Rubric",
  notes: "Notes",
  solutions: "Solutions",
  syllabus: "Syllabus",
  other: "Other",
};

const defaultBlueprint: BlueprintSection[] = [
  {
    id: "section-1",
    title: "Part A",
    questionType: "Short answer",
    questionCount: 5,
    durationMinutes: 30,
    points: 30,
  },
  {
    id: "section-2",
    title: "Part B",
    questionType: "Worked problems",
    questionCount: 3,
    durationMinutes: 60,
    points: 70,
  },
];

function sizeLabel(bytes: number) {
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1000))} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export function ExamForm({ exam }: { exam?: Exam }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { subjects, addExam, updateExam } = useDemo();
  const initialSubjectId =
    exam?.subjectId ?? searchParams.get("subject") ?? subjects[0]?.id ?? "";
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState(initialSubjectId);
  const [title, setTitle] = useState(exam?.title ?? "");
  const [description, setDescription] = useState(exam?.description ?? "");
  const [examType, setExamType] = useState(exam?.examType ?? "Written final");
  const [language, setLanguage] = useState<ExamLanguage>(
    exam?.language ?? "en",
  );
  const [targetDate, setTargetDate] = useState(exam?.targetDate ?? "");
  const [sources, setSources] = useState<ExamSource[]>(exam?.sources ?? []);
  const [pendingFiles, setPendingFiles] = useState<Array<{ id: string; file: File; kind: SourceKind }>>([]);
  const [sourceKind, setSourceKind] = useState<SourceKind>("past_exam");
  const [pastedContext, setPastedContext] = useState(exam?.pastedContext ?? "");
  const [blueprint, setBlueprint] = useState<BlueprintSection[]>(
    exam?.blueprint ?? defaultBlueprint,
  );
  const [mode, setMode] = useState<MockMode>(
    exam?.scenario.mode ?? "full_exam",
  );
  const [difficulty, setDifficulty] = useState(
    exam?.scenario.difficulty ?? "matched",
  );
  const [instructions, setInstructions] = useState(
    exam?.scenario.instructions ??
      "Match the official exam structure and ground every question in the uploaded material.",
  );
  const [durationMinutes, setDurationMinutes] = useState(
    exam?.rules.durationMinutes ?? 90,
  );
  const [totalPoints, setTotalPoints] = useState(
    exam?.rules.totalPoints ?? 100,
  );
  const [passPercentage, setPassPercentage] = useState(
    exam?.rules.passPercentage ?? 50,
  );
  const [penalty, setPenalty] = useState(
    exam?.rules.penalty ?? "No negative marking",
  );
  const [allowedMaterials, setAllowedMaterials] = useState(
    exam?.rules.allowedMaterials ?? "No materials",
  );
  const [gradingNotes, setGradingNotes] = useState(
    exam?.rules.gradingNotes ??
      "Award method points when intermediate reasoning is correct.",
  );
  const effectiveSubjectId = subjectId || subjects[0]?.id || "";
  const blueprintTotals = useMemo(
    () =>
      blueprint.reduce(
        (total, section) => ({
          minutes: total.minutes + section.durationMinutes,
          points: total.points + section.points,
          questions: total.questions + section.questionCount,
        }),
        { minutes: 0, points: 0, questions: 0 },
      ),
    [blueprint],
  );

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const queued = files.map((file, index) => ({
      id: `source-${Date.now()}-${index}`,
      file,
      kind: sourceKind,
    }));
    setPendingFiles((current) => [...current, ...queued]);
    setSources((current) => [
      ...current,
      ...queued.map((item) => ({
        id: item.id,
        name: item.file.name,
        kind: item.kind,
        size: sizeLabel(item.file.size),
        status: "processing" as const,
      })),
    ]);
    event.target.value = "";
  }

  function updateSection(id: string, patch: Partial<BlueprintSection>) {
    setBlueprint((current) =>
      current.map((section) =>
        section.id === id ? { ...section, ...patch } : section,
      ),
    );
  }

  function addSection() {
    setBlueprint((current) => [
      ...current,
      {
        id: `section-${Date.now()}`,
        title: `Part ${String.fromCharCode(65 + current.length)}`,
        questionType: "Short answer",
        questionCount: 1,
        durationMinutes: 15,
        points: 10,
      },
    ]);
  }

  function buildInput(): ExamInput {
    const contextSources =
      pastedContext.trim() &&
      !sources.some((source) => source.id === "pasted-context")
        ? [
            ...sources,
            {
              id: "pasted-context",
              name: "Additional context and notes",
              kind: "notes" as const,
              size: `${pastedContext.trim().length} characters`,
              status: "ready" as const,
            },
          ]
        : sources;
    return {
      subjectId: effectiveSubjectId,
      title: title.trim(),
      description: description.trim(),
      examType,
      language,
      targetDate,
      pastedContext: pastedContext.trim(),
      sources: contextSources,
      blueprint,
      scenario: { mode, difficulty, instructions: instructions.trim() },
      rules: {
        durationMinutes,
        totalPoints,
        passPercentage,
        penalty: penalty.trim(),
        allowedMaterials: allowedMaterials.trim(),
        gradingNotes: gradingNotes.trim(),
      },
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < steps.length - 1) {
      setStep((current) => current + 1);
      return;
    }
    if (!effectiveSubjectId || !title.trim()) return;
    setPending(true);
    setError(null);
    const input = buildInput();
    try {
      const saved = exam
        ? await updateExam(exam.id, input)
        : await addExam(input);
      if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
        for (const item of pendingFiles) {
          await uploadArtifact(saved.id, item.file, item.kind);
        }
      }
      router.push(`/exams/${saved.id}`);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to save this exam.",
      );
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-6 lg:grid-cols-[190px_minmax(0,760px)] lg:items-start"
    >
      <aside className="rounded-[14px] border border-line bg-surface-raised p-3 lg:sticky lg:top-24">
        <ol className="grid grid-cols-5 gap-1 lg:grid-cols-1">
          {steps.map((label, index) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => index <= step && setStep(index)}
                className={`flex min-h-10 w-full items-center gap-3 rounded-[9px] px-2.5 text-left text-xs font-medium transition ${index === step ? "bg-white text-ink shadow-soft" : index < step ? "text-signal" : "text-muted"}`}
              >
                <span
                  className={`grid size-5 shrink-0 place-items-center rounded-full border font-mono text-[10px] ${index < step ? "border-signal bg-signal text-white" : index === step ? "border-ink text-ink" : "border-line"}`}
                >
                  {index < step ? <Check size={12} /> : index + 1}
                </span>
                <span className="hidden lg:block">{label}</span>
              </button>
            </li>
          ))}
        </ol>
      </aside>
      <section className="rounded-[14px] border border-line bg-white p-5 sm:p-7">
        <div className="mb-7 border-b border-line pb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted">
            Step {step + 1} of {steps.length}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">
            {steps[step]}
          </h2>
        </div>

        {step === 0 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field
                label="Subject"
                hint="The Subject is only the category this Exam belongs to."
              >
                <Select
                  value={effectiveSubjectId}
                  onChange={(event) => setSubjectId(event.target.value)}
                  disabled={Boolean(exam)}
                  required
                >
                  {subjects.map((subject) => (
                    <option value={subject.id} key={subject.id}>
                      {subject.title} · {subject.courseCode}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Exam title">
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Final exam 2026"
                  required
                  autoFocus
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Description">
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  placeholder="What this exam covers and how it is administered."
                  className="w-full resize-y rounded-[9px] border border-line px-3.5 py-3 text-[15px] leading-6 focus:border-signal focus:outline-hidden"
                />
              </Field>
            </div>
            <Field label="Exam type">
              <Input
                value={examType}
                onChange={(event) => setExamType(event.target.value)}
                placeholder="Written final"
              />
            </Field>
            <Field label="Language">
              <Select
                value={language}
                onChange={(event) =>
                  setLanguage(event.target.value as ExamLanguage)
                }
              >
                <option value="en">English</option>
                <option value="de">German</option>
                <option value="ru">Russian</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Target date">
              <Input
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
              />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div>
            <p className="text-sm leading-6 text-muted">
              Add everything that should ground this Exam: past papers, rubrics,
              solutions, notes, and syllabus extracts. Files stay attached only
              to this Exam.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-[180px_1fr]">
              <Select
                value={sourceKind}
                onChange={(event) =>
                  setSourceKind(event.target.value as SourceKind)
                }
              >
                {Object.entries(sourceLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[9px] border border-dashed border-line bg-surface-raised text-sm font-semibold hover:border-signal hover:text-signal">
                <Upload size={16} /> Choose files
                <input
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt"
                  onChange={addFiles}
                  className="sr-only"
                />
              </label>
            </div>
            {sources.length ? (
              <div className="mt-5 divide-y divide-line rounded-[11px] border border-line">
                {sources.map((source) => (
                  <div
                    key={source.id}
                    className="flex items-center gap-3 p-3.5"
                  >
                    <span className="grid size-9 place-items-center rounded-[9px] bg-surface text-muted">
                      <FileText size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {source.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {sourceLabels[source.kind]} · {source.size}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSources((current) => current.filter((item) => item.id !== source.id));
                        setPendingFiles((current) => current.filter((item) => item.id !== source.id));
                      }}
                      className="grid size-9 place-items-center rounded-[8px] text-muted hover:bg-red-50 hover:text-danger"
                      aria-label={`Remove ${source.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-[11px] border border-dashed border-line p-6 text-center">
                <FileText size={20} className="mx-auto text-muted" />
                <p className="mt-3 text-sm font-semibold">No files yet</p>
                <p className="mt-1 text-xs text-muted">
                  You can continue and add them later from Exam detail.
                </p>
              </div>
            )}
            <div className="mt-6">
              <Field
                label="Additional context"
                hint="Paste rules, teacher notes, known topics, or constraints that are not in a file."
              >
                <textarea
                  value={pastedContext}
                  onChange={(event) => setPastedContext(event.target.value)}
                  rows={6}
                  placeholder="Example: The professor always includes one proof question from graph theory…"
                  className="w-full resize-y rounded-[9px] border border-line px-3.5 py-3 text-[15px] leading-6 focus:border-signal focus:outline-hidden"
                />
              </Field>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="flex items-center justify-between gap-4">
              <p className="max-w-lg text-sm leading-6 text-muted">
                Describe the real exam structure. This is the contract used to
                generate every mock.
              </p>
              <Button type="button" variant="secondary" onClick={addSection}>
                <Plus size={15} /> Add part
              </Button>
            </div>
            <div className="mt-5 grid gap-3">
              {blueprint.map((section, index) => (
                <div
                  key={section.id}
                  className="rounded-[11px] border border-line p-4"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <span className="grid size-7 place-items-center rounded-[7px] bg-contrast font-mono text-[11px] font-semibold text-contrast-ink">
                      {index + 1}
                    </span>
                    <Input
                      value={section.title}
                      onChange={(event) =>
                        updateSection(section.id, { title: event.target.value })
                      }
                      className="min-h-9"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setBlueprint((current) =>
                          current.filter((item) => item.id !== section.id),
                        )
                      }
                      className="grid size-9 shrink-0 place-items-center rounded-[8px] text-muted hover:bg-red-50 hover:text-danger"
                      aria-label={`Remove ${section.title}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <Field label="Question type">
                      <Input
                        value={section.questionType}
                        onChange={(event) =>
                          updateSection(section.id, {
                            questionType: event.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Questions">
                      <Input
                        type="number"
                        min={1}
                        value={section.questionCount}
                        onChange={(event) =>
                          updateSection(section.id, {
                            questionCount: Number(event.target.value),
                          })
                        }
                      />
                    </Field>
                    <Field label="Minutes">
                      <Input
                        type="number"
                        min={1}
                        value={section.durationMinutes}
                        onChange={(event) =>
                          updateSection(section.id, {
                            durationMinutes: Number(event.target.value),
                          })
                        }
                      />
                    </Field>
                    <Field label="Points">
                      <Input
                        type="number"
                        min={1}
                        value={section.points}
                        onChange={(event) =>
                          updateSection(section.id, {
                            points: Number(event.target.value),
                          })
                        }
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-[11px] bg-surface p-4 text-center">
              <div>
                <p className="font-mono text-xl font-semibold">
                  {blueprintTotals.questions}
                </p>
                <p className="text-[11px] text-muted">Questions</p>
              </div>
              <div>
                <p className="font-mono text-xl font-semibold">
                  {blueprintTotals.minutes}
                </p>
                <p className="text-[11px] text-muted">Minutes</p>
              </div>
              <div>
                <p className="font-mono text-xl font-semibold">
                  {blueprintTotals.points}
                </p>
                <p className="text-[11px] text-muted">Points</p>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-7">
            <fieldset>
              <legend className="text-sm font-semibold">
                Generation scenario
              </legend>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Mode">
                  <Select
                    value={mode}
                    onChange={(event) =>
                      setMode(event.target.value as MockMode)
                    }
                  >
                    <option value="full_exam">Full exam</option>
                    <option value="section_only">Section only</option>
                    <option value="adaptive">Adaptive</option>
                  </Select>
                </Field>
                <Field label="Difficulty">
                  <Select
                    value={difficulty}
                    onChange={(event) =>
                      setDifficulty(event.target.value as typeof difficulty)
                    }
                  >
                    <option value="matched">Match source exams</option>
                    <option value="easier">Slightly easier</option>
                    <option value="harder">Slightly harder</option>
                  </Select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Generation instructions">
                    <textarea
                      value={instructions}
                      onChange={(event) => setInstructions(event.target.value)}
                      rows={4}
                      className="w-full resize-y rounded-[9px] border border-line px-3.5 py-3 text-[15px] leading-6 focus:border-signal focus:outline-hidden"
                    />
                  </Field>
                </div>
              </div>
            </fieldset>
            <fieldset className="border-t border-line pt-6">
              <legend className="text-sm font-semibold">
                Rules and grading
              </legend>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Field label="Time limit">
                  <Input
                    type="number"
                    min={1}
                    value={durationMinutes}
                    onChange={(event) =>
                      setDurationMinutes(Number(event.target.value))
                    }
                  />
                </Field>
                <Field label="Total points">
                  <Input
                    type="number"
                    min={1}
                    value={totalPoints}
                    onChange={(event) =>
                      setTotalPoints(Number(event.target.value))
                    }
                  />
                </Field>
                <Field label="Pass mark (%)">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={passPercentage}
                    onChange={(event) =>
                      setPassPercentage(Number(event.target.value))
                    }
                  />
                </Field>
                <div className="sm:col-span-3">
                  <Field label="Allowed materials">
                    <Input
                      value={allowedMaterials}
                      onChange={(event) =>
                        setAllowedMaterials(event.target.value)
                      }
                    />
                  </Field>
                </div>
                <div className="sm:col-span-3">
                  <Field label="Penalties">
                    <Input
                      value={penalty}
                      onChange={(event) => setPenalty(event.target.value)}
                    />
                  </Field>
                </div>
                <div className="sm:col-span-3">
                  <Field label="Grading notes">
                    <textarea
                      value={gradingNotes}
                      onChange={(event) => setGradingNotes(event.target.value)}
                      rows={4}
                      className="w-full resize-y rounded-[9px] border border-line px-3.5 py-3 text-[15px] leading-6 focus:border-signal focus:outline-hidden"
                    />
                  </Field>
                </div>
              </div>
            </fieldset>
          </div>
        )}

        {step === 4 && (
          <div>
            <div className="rounded-[12px] border border-line bg-surface-raised p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-muted">
                    {
                      subjects.find((subject) => subject.id === subjectId)
                        ?.title
                    }
                  </p>
                  <h3 className="mt-1 text-xl font-semibold">
                    {title || "Untitled exam"}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {description || "No description provided."}
                  </p>
                </div>
                <BookOpen size={22} className="text-signal" />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-5 sm:grid-cols-4">
                <div>
                  <p className="text-[11px] text-muted">Data</p>
                  <p className="mt-1 text-sm font-semibold">
                    {sources.length + (pastedContext.trim() ? 1 : 0)} sources
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted">Blueprint</p>
                  <p className="mt-1 text-sm font-semibold">
                    {blueprint.length} parts
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted">Duration</p>
                  <p className="mt-1 text-sm font-semibold">
                    {durationMinutes} min
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted">Points</p>
                  <p className="mt-1 text-sm font-semibold">{totalPoints}</p>
                </div>
              </div>
            </div>
            <div
              className={`mt-4 rounded-[10px] border p-4 text-sm ${blueprint.length ? "border-success/20 bg-emerald-50 text-emerald-800" : "border-warning/25 bg-amber-50 text-amber-900"}`}
            >
              {blueprint.length
                ? "Ready to create. Queued files will upload securely after the Exam is saved, and more can be added from its Data tab."
                : "This Exam will be saved as a draft. Add at least one blueprint part before generating a mock."}
            </div>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="mt-6 rounded-[9px] border border-danger/30 bg-red-50 px-3.5 py-3 text-sm text-danger"
          >
            {error}
          </p>
        )}
        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-between">
          <div className="flex gap-2">
            <Link
              href={
                exam
                  ? `/exams/${exam.id}`
                  : subjectId
                    ? `/subjects/${subjectId}`
                    : "/exams"
              }
              className="inline-flex min-h-10 items-center justify-center rounded-[9px] px-3 text-sm font-semibold text-muted hover:bg-surface"
            >
              Cancel
            </Link>
            {step > 0 && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep((current) => current - 1)}
              >
                <ArrowLeft size={15} /> Back
              </Button>
            )}
          </div>
          <Button
            type="submit"
            disabled={pending || (step === 0 && (!title.trim() || !subjectId))}
          >
            {pending
              ? "Saving…"
              : step === steps.length - 1
                ? exam
                  ? "Save changes"
                  : "Create exam"
                : "Continue"}
            {!pending && <ArrowRight size={15} />}
          </Button>
        </div>
      </section>
    </form>
  );
}
