"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useDemo } from "@/features/demo/demo-provider";
import type { Subject, SubjectInput, SubjectVisibility } from "@/features/subjects/types";

export function SubjectForm({ subject }: { subject?: Subject }) {
  const router = useRouter();
  const { addSubject, updateSubject } = useDemo();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const input: SubjectInput = {
      title: String(form.get("title") || ""),
      university: String(form.get("university") || ""),
      courseCode: String(form.get("courseCode") || ""),
      visibility: String(form.get("visibility") || "private") as SubjectVisibility,
    };
    try {
      const saved = subject ? await updateSubject(subject.id, input) : await addSubject(input);
      router.push(`/subjects/${saved.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save this subject.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,680px)_280px]">
      <section className="rounded-[14px] border border-line bg-white p-5 sm:p-7">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Subject name" hint="Use the name you recognize from your timetable."><Input name="title" defaultValue={subject?.title} placeholder="Quantum Physics" required autoFocus /></Field></div>
          <Field label="University or institution"><Input name="university" defaultValue={subject?.university} placeholder="TU Wien" /></Field>
          <Field label="Course code"><Input name="courseCode" defaultValue={subject?.courseCode} placeholder="PHY-401" /></Field>
          <Field label="Visibility"><Select name="visibility" defaultValue={subject?.visibility ?? "private"}><option value="private">Private</option><option value="team">Team</option><option value="public">Public</option></Select></Field>
        </div>
        {error && <p role="alert" className="mt-5 rounded-[9px] border border-danger/30 bg-red-50 px-3.5 py-3 text-sm text-danger">{error}</p>}
        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-between">
          <Link href={subject ? `/subjects/${subject.id}` : "/subjects"} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] px-3 text-sm font-semibold text-muted hover:bg-surface"><ArrowLeft size={16} /> Cancel</Link>
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : subject ? "Save changes" : "Create subject"}{!pending && <ArrowRight size={16} />}</Button>
        </div>
      </section>
      <aside className="h-fit rounded-[14px] border border-line bg-surface-raised p-5">
        <p className="text-sm font-semibold">What belongs here?</p>
        <p className="mt-2 text-xs leading-5 text-muted">A Subject is a lightweight category that keeps related Exams and Classes together.</p>
        <div className="mt-5 rounded-[10px] border border-line bg-white p-3.5 text-xs leading-5 text-muted"><strong className="font-semibold text-ink">Example</strong><br />Quantum Physics can contain a midterm and a final. Each Exam owns its files, blueprint, rules, mocks and history.</div>
      </aside>
    </form>
  );
}
