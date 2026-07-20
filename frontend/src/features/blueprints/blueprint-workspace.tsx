"use client";

import {
  AlertTriangle,
  Check,
  ChevronDown,
  FileSearch,
  LoaderCircle,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import type { Exam } from "@/features/exams/types";
import { ApiError } from "@/lib/api/browser";

import {
  approveBlueprint,
  extractBlueprint,
  getCurrentBlueprint,
  retryBlueprint,
  updateBlueprintDraft,
  type BlueprintContent,
  type BlueprintDto,
} from "./api";

type Action = "extract" | "save" | "approve" | "retry" | null;

function confidenceLabel(value: number) {
  if (value >= 0.8) return "High confidence";
  if (value >= 0.55) return "Medium confidence";
  return "Low confidence";
}

function confidenceTone(value: number) {
  if (value >= 0.8) return "success" as const;
  if (value >= 0.55) return "warning" as const;
  return "danger" as const;
}

export function BlueprintWorkspace({
  exam,
  onApproved,
}: {
  exam: Exam;
  onApproved: () => void | Promise<void>;
}) {
  const [blueprint, setBlueprint] = useState<BlueprintDto | null>(null);
  const [draft, setDraft] = useState<BlueprintContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<Action>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let active = true;
    void getCurrentBlueprint(exam.id)
      .then((value) => {
        if (active) {
          setBlueprint(value);
          setDraft(value.content);
        }
      })
      .catch((reason: unknown) => {
        if (active && (!(reason instanceof ApiError) || reason.status !== 404)) {
          setError(
            reason instanceof Error
              ? reason.message
              : "The blueprint could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [exam.id]);

  const evidence = useMemo(
    () => new Map((draft?.evidence ?? []).map((item) => [item.chunk_id, item])),
    [draft?.evidence],
  );
  const editable = blueprint?.status === "draft" || blueprint?.status === "failed";

  function replaceDraft(next: BlueprintContent) {
    setDraft(next);
    setDirty(true);
    setError(null);
  }

  async function extract() {
    setAction("extract");
    setError(null);
    try {
      const value = await extractBlueprint(exam.id);
      setBlueprint(value);
      setDraft(value.content);
      setDirty(false);
      if (value.status === "failed") {
        setError(value.error_message ?? "The extracted draft did not pass validation.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Blueprint extraction failed.");
    } finally {
      setAction(null);
    }
  }

  async function save() {
    if (!blueprint || !draft) return null;
    setAction("save");
    setError(null);
    try {
      const value = await updateBlueprintDraft(blueprint.id, draft);
      setBlueprint(value);
      setDraft(value.content);
      setDirty(false);
      if (value.status === "failed") {
        setError(value.error_message ?? "Review the invalid fields below.");
      }
      return value;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The draft could not be saved.");
      return null;
    } finally {
      setAction(null);
    }
  }

  async function approve() {
    if (!blueprint || !draft) return;
    setAction("approve");
    setError(null);
    try {
      let target = blueprint;
      if (dirty) {
        target = await updateBlueprintDraft(blueprint.id, draft);
        setBlueprint(target);
        setDraft(target.content);
        setDirty(false);
      }
      const value = await approveBlueprint(target.id);
      setBlueprint(value);
      setDraft(value.content);
      await onApproved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The blueprint could not be approved.");
    } finally {
      setAction(null);
    }
  }

  async function retry() {
    if (!blueprint) return;
    setAction("retry");
    setError(null);
    try {
      const value = await retryBlueprint(blueprint.id);
      setBlueprint(value);
      setDraft(value.content);
      setDirty(false);
      if (value.status === "failed") {
        setError(value.error_message ?? "The new extraction did not pass validation.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Extraction retry failed.");
    } finally {
      setAction(null);
    }
  }

  function confirmExistingRules() {
    if (!draft) return;
    replaceDraft({
      ...draft,
      rules: {
        ...draft.rules,
        duration_minutes:
          draft.rules.duration_minutes ?? exam.rules.durationMinutes,
        total_points: draft.rules.total_points ?? exam.rules.totalPoints,
        pass_percentage:
          draft.rules.pass_percentage ?? exam.rules.passPercentage,
      },
      unresolved_fields: [],
    });
  }

  if (loading) {
    return (
      <div className="grid min-h-[260px] place-items-center rounded-[13px] border border-line">
        <span className="flex items-center gap-2 text-sm text-muted">
          <LoaderCircle size={16} className="animate-spin" /> Loading blueprint…
        </span>
      </div>
    );
  }

  if (!blueprint || !draft) {
    return (
      <div className="grid min-h-[300px] place-items-center rounded-[14px] border border-dashed border-line bg-surface-raised p-7 text-center">
        <div className="max-w-[500px]">
          <span className="mx-auto grid size-12 place-items-center rounded-[12px] bg-signal-soft text-signal">
            <FileSearch size={21} />
          </span>
          <h2 className="mt-4 text-lg font-semibold">Extract the exam structure</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            AI will compare the processed past exams, rubrics, and notes, then
            produce a cited draft for your review. Nothing is approved automatically.
          </p>
          <Button className="mt-5" onClick={() => void extract()} disabled={Boolean(action)}>
            {action === "extract" ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            {action === "extract" ? "Extracting blueprint…" : "Extract with AI"}
          </Button>
          {error && <p className="mt-4 text-sm text-danger" role="alert">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill
              tone={
                blueprint.status === "approved"
                  ? "success"
                  : blueprint.status === "failed"
                    ? "danger"
                    : blueprint.status === "stale"
                      ? "warning"
                      : "signal"
              }
            >
              {blueprint.status}
            </StatusPill>
            <StatusPill tone={confidenceTone(draft.overall_confidence)}>
              {confidenceLabel(draft.overall_confidence)} · {Math.round(draft.overall_confidence * 100)}%
            </StatusPill>
          </div>
          <h2 className="mt-3 text-lg font-semibold">Blueprint review · version {blueprint.version}</h2>
          <p className="mt-1 text-sm text-muted">
            {blueprint.provider}:{blueprint.model} · {blueprint.source_artifact_ids.length} source files
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(blueprint.status === "failed" || blueprint.status === "stale") && (
            <Button variant="secondary" onClick={() => void retry()} disabled={Boolean(action)}>
              {action === "retry" ? <LoaderCircle size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              Re-extract
            </Button>
          )}
          {editable && (
            <Button variant="secondary" onClick={() => void save()} disabled={!dirty || Boolean(action)}>
              {action === "save" ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}
              Save review
            </Button>
          )}
          {blueprint.status === "draft" && (
            <Button onClick={() => void approve()} disabled={Boolean(action)}>
              {action === "approve" ? <LoaderCircle size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
              Approve blueprint
            </Button>
          )}
        </div>
      </div>

      {(blueprint.status === "stale" || blueprint.status === "failed" || error) && (
        <div role="alert" className="mt-5 flex gap-3 rounded-[11px] border border-warning/20 bg-amber-50 p-4 text-sm text-warning">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">
              {blueprint.status === "stale" ? "Sources changed after approval" : "Blueprint needs attention"}
            </p>
            <p className="mt-1 leading-5">
              {error ?? blueprint.error_message ?? "Re-extract or correct the fields before approval."}
            </p>
          </div>
        </div>
      )}

      {draft.unresolved_fields.length > 0 && (
        <section className="mt-5 rounded-[12px] border border-warning/25 bg-amber-50/50 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold">{draft.unresolved_fields.length} unresolved fields</p>
              <ul className="mt-2 grid gap-1 text-xs leading-5 text-muted">
                {draft.unresolved_fields.map((item) => (
                  <li key={`${item.path}-${item.reason}`}><strong className="text-ink">{item.path}</strong> — {item.reason}</li>
                ))}
              </ul>
            </div>
            {editable && (
              <Button variant="secondary" onClick={confirmExistingRules}>
                <Check size={15} /> Confirm reviewed values
              </Button>
            )}
          </div>
        </section>
      )}

      <section className="mt-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">Exam sections</p>
            <p className="mt-1 text-xs text-muted">Each structural claim remains connected to its source evidence.</p>
          </div>
          <p className="font-mono text-xs text-muted">
            {draft.sections.reduce((sum, item) => sum + item.question_count, 0)} questions · {draft.sections.reduce((sum, item) => sum + item.points, 0)} pts
          </p>
        </div>
        <div className="mt-4 grid gap-4">
          {draft.sections.map((section, sectionIndex) => (
            <article key={section.id} className="overflow-hidden rounded-[13px] border border-line">
              <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="p-5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted">{String(sectionIndex + 1).padStart(2, "0")}</span>
                    <StatusPill tone={confidenceTone(section.confidence)}>{Math.round(section.confidence * 100)}%</StatusPill>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <Field label="Section title">
                      <input disabled={!editable} value={section.title} onChange={(event) => replaceDraft({ ...draft, sections: draft.sections.map((item, index) => index === sectionIndex ? { ...item, title: event.target.value } : item) })} className="w-full rounded-[8px] border border-line bg-white px-3 py-2 text-sm disabled:bg-surface disabled:text-ink" />
                    </Field>
                    <Field label="Question type">
                      <input disabled={!editable} value={section.question_type} onChange={(event) => replaceDraft({ ...draft, sections: draft.sections.map((item, index) => index === sectionIndex ? { ...item, question_type: event.target.value } : item) })} className="w-full rounded-[8px] border border-line bg-white px-3 py-2 text-sm disabled:bg-surface disabled:text-ink" />
                    </Field>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <NumberField label="Questions" value={section.question_count} disabled={!editable} onChange={(value) => replaceDraft({ ...draft, sections: draft.sections.map((item, index) => index === sectionIndex ? { ...item, question_count: value } : item) })} />
                    <NumberField label="Minutes" value={section.duration_minutes} disabled={!editable} onChange={(value) => replaceDraft({ ...draft, sections: draft.sections.map((item, index) => index === sectionIndex ? { ...item, duration_minutes: value } : item) })} />
                    <NumberField label="Points" value={section.points} disabled={!editable} onChange={(value) => replaceDraft({ ...draft, sections: draft.sections.map((item, index) => index === sectionIndex ? { ...item, points: value } : item) })} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {section.skills.map((skill) => <span key={skill} className="rounded-full bg-signal-soft px-2.5 py-1 font-mono text-[10px] text-signal">{skill}</span>)}
                  </div>
                </div>
                <aside className="border-t border-line bg-surface-raised p-5 lg:border-l lg:border-t-0">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted"><FileSearch size={14} /> Evidence rail</p>
                  <div className="mt-3 grid gap-3">
                    {section.source_refs.map((sourceId) => {
                      const source = evidence.get(sourceId);
                      return (
                        <details key={sourceId} className="group rounded-[9px] border border-line bg-white p-3">
                          <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold">
                            <span className="min-w-0 flex-1 truncate">{source?.artifact_name ?? `Source ${sourceId.slice(0, 8)}`}</span>
                            {source?.page_number ? <span className="font-mono text-[10px] text-muted">p. {source.page_number}</span> : null}
                            <ChevronDown size={13} className="text-muted transition group-open:rotate-180" />
                          </summary>
                          <p className="mt-2 text-xs leading-5 text-muted">{source?.excerpt ?? "Verified source chunk"}</p>
                        </details>
                      );
                    })}
                  </div>
                </aside>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-[13px] border border-line p-5">
        <p className="text-sm font-semibold">Exam rules</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <NullableNumberField label="Total minutes" value={draft.rules.duration_minutes} disabled={!editable} onChange={(value) => replaceDraft({ ...draft, rules: { ...draft.rules, duration_minutes: value } })} />
          <NullableNumberField label="Total points" value={draft.rules.total_points} disabled={!editable} onChange={(value) => replaceDraft({ ...draft, rules: { ...draft.rules, total_points: value } })} />
          <NullableNumberField label="Pass percentage" value={draft.rules.pass_percentage} disabled={!editable} onChange={(value) => replaceDraft({ ...draft, rules: { ...draft.rules, pass_percentage: value } })} />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label="Allowed materials"><textarea disabled={!editable} value={draft.rules.allowed_materials} onChange={(event) => replaceDraft({ ...draft, rules: { ...draft.rules, allowed_materials: event.target.value } })} className="min-h-20 w-full resize-y rounded-[8px] border border-line bg-white px-3 py-2 text-sm disabled:bg-surface" /></Field>
          <Field label="Grading notes"><textarea disabled={!editable} value={draft.rules.grading_notes} onChange={(event) => replaceDraft({ ...draft, rules: { ...draft.rules, grading_notes: event.target.value } })} className="min-h-20 w-full resize-y rounded-[8px] border border-line bg-white px-3 py-2 text-sm disabled:bg-surface" /></Field>
        </div>
      </section>

      {blueprint.status === "approved" && (
        <div className="mt-5 flex items-start gap-3 rounded-[11px] border border-success/20 bg-emerald-50 p-4 text-sm text-success">
          <ShieldCheck size={18} className="mt-0.5 shrink-0" />
          <div><p className="font-semibold">Approved generation contract</p><p className="mt-1 text-xs leading-5">Every new mock is validated against this exact version before it is saved.</p></div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[11px] font-medium text-muted">{label}</span>{children}</label>;
}

function NumberField({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (value: number) => void }) {
  return <Field label={label}><input type="number" min={1} disabled={disabled} value={value} onChange={(event) => onChange(Math.max(1, Number(event.target.value)))} className="w-full rounded-[8px] border border-line bg-white px-3 py-2 font-mono text-sm disabled:bg-surface" /></Field>;
}

function NullableNumberField({ label, value, disabled, onChange }: { label: string; value: number | null; disabled: boolean; onChange: (value: number | null) => void }) {
  return <Field label={label}><input type="number" min={1} disabled={disabled} value={value ?? ""} onChange={(event) => onChange(event.target.value ? Math.max(1, Number(event.target.value)) : null)} className="w-full rounded-[8px] border border-line bg-white px-3 py-2 font-mono text-sm disabled:bg-surface" /></Field>;
}
