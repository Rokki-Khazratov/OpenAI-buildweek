"use client";

import { ArrowLeft, ArrowRight, BookOpen, Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import type { ClassExamScope, StudyClass, StudyClassInput } from "@/features/classes/types";
import { useDemo } from "@/features/demo/demo-provider";

export function ClassForm({ studyClass }: { studyClass?: StudyClass }) {
  const router = useRouter();
  const { subjects, exams, addClass, updateClass } = useDemo();
  const [subjectId, setSubjectId] = useState(studyClass?.subjectId ?? subjects[0]?.id ?? "");
  const [examScope, setExamScope] = useState<ClassExamScope>(studyClass?.examScope ?? "subject");
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>(studyClass?.examIds ?? []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const effectiveSubjectId = subjectId || subjects[0]?.id || "";
  const subjectExams = exams.filter((exam) => exam.subjectId === effectiveSubjectId);

  function changeSubject(nextId: string) {
    setSubjectId(nextId);
    setSelectedExamIds([]);
  }

  function toggleExam(examId: string) {
    setSelectedExamIds((current) => current.includes(examId)
      ? current.filter((id) => id !== examId)
      : [...current, examId]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!effectiveSubjectId || (examScope === "selected" && selectedExamIds.length === 0)) return;
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const input: StudyClassInput = {
      subjectId: effectiveSubjectId,
      name: String(form.get("name") || "").trim(),
      description: String(form.get("description") || "").trim(),
      examScope,
      examIds: examScope === "selected" ? selectedExamIds : [],
    };
    try {
      const saved = studyClass ? await updateClass(studyClass.id, input) : await addClass(input);
      router.push(`/classes/${saved.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save this class.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,680px)_280px]">
      <section className="rounded-[14px] border border-line bg-white p-5 sm:p-7">
        <div className="grid gap-5">
          <Field label="Class name" hint="Use a name you will recognize."><Input name="name" defaultValue={studyClass?.name} placeholder="Final exam study group" required autoFocus /></Field>
          <Field label="Description" hint="Describe the purpose, schedule, or expectations for this class."><textarea name="description" defaultValue={studyClass?.description} rows={4} placeholder="Work through past papers every Thursday." className="w-full resize-y rounded-[9px] border border-line bg-white px-3.5 py-3 text-[15px] leading-6 text-ink placeholder:text-[#a1a1a7] hover:border-[#ceced3] focus:border-signal focus:outline-hidden" /></Field>
          <Field label="Subject"><Select name="subjectId" value={effectiveSubjectId} onChange={(event) => changeSubject(event.target.value)} required disabled={Boolean(studyClass)}>{subjects.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.courseCode}</option>)}</Select></Field>
          <fieldset className="grid gap-3">
            <legend className="text-sm font-medium">Shared scope</legend>
            <label className={`flex cursor-pointer gap-3 rounded-[11px] border p-4 transition ${examScope === "subject" ? "border-signal bg-signal-soft" : "border-line hover:bg-surface"}`}><input type="radio" name="examScope" value="subject" checked={examScope === "subject"} onChange={() => setExamScope("subject")} className="mt-1 accent-[var(--color-signal)]" /><span><span className="block text-sm font-semibold">Entire subject</span><span className="mt-1 block text-xs leading-5 text-muted">Members can access every current and future exam in this subject.</span></span></label>
            <label className={`flex cursor-pointer gap-3 rounded-[11px] border p-4 transition ${examScope === "selected" ? "border-signal bg-signal-soft" : "border-line hover:bg-surface"}`}><input type="radio" name="examScope" value="selected" checked={examScope === "selected"} onChange={() => setExamScope("selected")} className="mt-1 accent-[var(--color-signal)]" /><span><span className="block text-sm font-semibold">Selected exams</span><span className="mt-1 block text-xs leading-5 text-muted">Share only the exam definitions you choose below.</span></span></label>
          </fieldset>
          {examScope === "selected" && <div className="rounded-[11px] border border-line p-4"><p className="text-sm font-medium">Select exams</p>{subjectExams.length ? <div className="mt-3 grid gap-2">{subjectExams.map((exam) => { const active = selectedExamIds.includes(exam.id); return <button key={exam.id} type="button" onClick={() => toggleExam(exam.id)} className={`flex items-center gap-3 rounded-[9px] border p-3 text-left ${active ? "border-signal bg-signal-soft" : "border-line"}`}><span className={`grid size-5 place-items-center rounded border ${active ? "border-signal bg-signal text-white" : "border-line"}`}>{active && <Check size={13} />}</span><BookOpen size={16} className="text-muted" /><span className="text-sm font-medium">{exam.title}</span></button>; })}</div> : <p className="mt-2 text-xs leading-5 text-danger">This subject has no exams. Choose entire subject or add an exam first.</p>}</div>}
        </div>
        {error && <p role="alert" className="mt-5 rounded-[9px] border border-danger/30 bg-red-50 px-3.5 py-3 text-sm text-danger">{error}</p>}
        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-between"><Link href={studyClass ? `/classes/${studyClass.id}` : "/classes"} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] px-3 text-sm font-semibold text-muted hover:bg-surface"><ArrowLeft size={16} /> Cancel</Link><Button type="submit" disabled={pending || !subjectId || (examScope === "selected" && selectedExamIds.length === 0)}>{pending ? "Saving…" : studyClass ? "Save changes" : "Create class"}{!pending && <ArrowRight size={16} />}</Button></div>
      </section>
      <aside className="h-fit rounded-[14px] border border-line bg-surface-raised p-5"><p className="text-sm font-semibold">How classes work in P0</p><p className="mt-2 text-xs leading-5 text-muted">A class saves a subject-wide or selected-exam scope. Invitations and membership management are intentionally deferred.</p><div className="mt-5 rounded-[10px] border border-line bg-white p-3.5 text-xs leading-5 text-muted"><strong className="font-semibold text-ink">Owner-only</strong><br />Creating a class does not publish or share your subject.</div></aside>
    </form>
  );
}
