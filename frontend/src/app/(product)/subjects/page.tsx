"use client";

import { Grid2X2, List, Plus, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { PageFrame } from "@/components/layout/page-frame";
import { SubjectCard } from "@/features/subjects/subject-card";
import { useDemo } from "@/features/demo/demo-provider";

export default function SubjectsPage() {
  const { subjects, exams, loading, error, reload } = useDemo();
  const [query, setQuery] = useState("");
  const visible = useMemo(() => subjects.filter((subject) => `${subject.title} ${subject.courseCode} ${subject.university}`.toLowerCase().includes(query.toLowerCase())), [query, subjects]);

  if (loading) return <PageFrame eyebrow="Workspace" title="Subjects"><div className="rounded-[14px] border border-line bg-white p-8 text-sm text-muted">Loading your subjects…</div></PageFrame>;
  if (error) return <PageFrame eyebrow="Workspace" title="Subjects"><div className="rounded-[14px] border border-danger/30 bg-red-50 p-6"><p className="text-sm text-danger">{error}</p><button onClick={() => void reload()} className="mt-4 text-sm font-semibold text-signal">Try again</button></div></PageFrame>;

  return (
    <PageFrame eyebrow={`${subjects.length} subjects · ${exams.length} exams`} title="Subjects" description="Lightweight categories for organizing your exam work." action={<Link href="/subjects/new" className="inline-flex min-h-10 items-center gap-2 rounded-[9px] bg-signal px-4 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(46,46,255,0.18)]"><Plus size={16} /> New subject</Link>}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex min-h-10 flex-1 items-center gap-2.5 rounded-[9px] border border-line bg-white px-3.5 text-sm text-muted sm:max-w-[420px]"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search subjects" className="w-full bg-transparent text-ink outline-none placeholder:text-muted" /></label>
        <button className="inline-flex min-h-10 items-center gap-2 rounded-[9px] border border-line bg-white px-3 text-sm font-medium text-muted hover:bg-surface"><SlidersHorizontal size={15} /> Filter</button>
        <div className="ml-auto hidden rounded-[9px] border border-line bg-white p-1 sm:flex"><button className="grid size-8 place-items-center rounded-[6px] bg-surface text-ink" aria-label="Grid view"><Grid2X2 size={15} /></button><button className="grid size-8 place-items-center rounded-[6px] text-muted" aria-label="List view"><List size={16} /></button></div>
      </div>
      {visible.length ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{visible.map((subject) => <SubjectCard key={subject.id} subject={subject} examCount={exams.filter((exam) => exam.subjectId === subject.id).length} />)}</div>
      ) : (
        <div className="grid min-h-[320px] place-items-center rounded-[14px] border border-dashed border-line bg-surface-raised p-8 text-center"><div><p className="font-semibold">{query ? `No subjects match “${query}”` : "Create your first Subject"}</p><p className="mt-2 text-sm text-muted">{query ? "Try a different title, institution or course code." : "Subjects keep related Exams and Classes together."}</p>{!query && <Link href="/subjects/new" className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-[9px] bg-signal px-4 text-sm font-semibold text-white"><Plus size={16} /> New subject</Link>}</div></div>
      )}
    </PageFrame>
  );
}
