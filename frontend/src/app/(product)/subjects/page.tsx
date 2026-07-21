"use client";

import { Grid2X2, List, Plus, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { PageFrame } from "@/components/layout/page-frame";
import { SubjectCard } from "@/features/subjects/subject-card";
import { useDemo } from "@/features/demo/demo-provider";
import type { Subject, SubjectVisibility } from "@/features/subjects/types";

type Sort = "updated" | "title" | "exams";
type Group = "none" | "university" | "visibility";
type View = "grid" | "list";

export default function SubjectsPage() {
  const { subjects, exams, loading, error, reload } = useDemo();
  const [query, setQuery] = useState("");
  const [visibility, setVisibility] = useState<"all" | SubjectVisibility>("all");
  const [sort, setSort] = useState<Sort>("updated");
  const [group, setGroup] = useState<Group>("none");
  const [view, setView] = useState<View>("grid");

  const examCounts = useMemo(() => exams.reduce<Record<string, number>>((counts, exam) => ({ ...counts, [exam.subjectId]: (counts[exam.subjectId] ?? 0) + 1 }), {}), [exams]);
  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return subjects
      .map((subject, index) => ({ subject, index }))
      .filter(({ subject }) => {
        const searchable = `${subject.title} ${subject.courseCode} ${subject.university} ${subject.visibility}`.toLocaleLowerCase();
        return (!term || searchable.includes(term)) && (visibility === "all" || subject.visibility === visibility);
      })
      .sort((left, right) => {
        if (sort === "title") return left.subject.title.localeCompare(right.subject.title);
        if (sort === "exams") return (examCounts[right.subject.id] ?? 0) - (examCounts[left.subject.id] ?? 0) || left.subject.title.localeCompare(right.subject.title);
        return left.index - right.index;
      })
      .map(({ subject }) => subject);
  }, [examCounts, query, sort, subjects, visibility]);

  const groups = useMemo(() => {
    if (group === "none") return [["All subjects", visible]] as Array<[string, Subject[]]>;
    const grouped = new Map<string, Subject[]>();
    visible.forEach((subject) => {
      const key = group === "university" ? subject.university || "No institution" : subject.visibility[0].toUpperCase() + subject.visibility.slice(1);
      grouped.set(key, [...(grouped.get(key) ?? []), subject]);
    });
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [group, visible]);

  if (loading) return <PageFrame eyebrow="Workspace" title="Subjects"><div className="rounded-[14px] border border-line bg-white p-8 text-sm text-muted">Loading your subjects…</div></PageFrame>;
  if (error) return <PageFrame eyebrow="Workspace" title="Subjects"><div className="rounded-[14px] border border-danger/30 bg-red-50 p-6"><p className="text-sm text-danger">{error}</p><button onClick={() => void reload()} className="mt-4 text-sm font-semibold text-signal">Try again</button></div></PageFrame>;

  return (
    <PageFrame eyebrow={`${subjects.length} subjects · ${exams.length} exams`} title="Subjects" description="Lightweight categories for organizing your exam work." action={<Link href="/subjects/new" className="inline-flex min-h-10 items-center gap-2 rounded-[9px] bg-signal px-4 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(46,46,255,0.18)]"><Plus size={16} /> New subject</Link>}>
      <div className="mb-6 grid gap-3 rounded-[14px] border border-line bg-surface-raised p-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_150px_170px_170px_auto]">
        <label className="flex min-h-11 items-center gap-2.5 rounded-[9px] border border-line bg-white px-3.5 text-sm text-muted"><Search size={16} /><input aria-label="Search subjects" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search subjects" className="w-full bg-transparent text-ink outline-none placeholder:text-muted" /></label>
        <label className="relative"><span className="sr-only">Filter by visibility</span><select value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)} className="min-h-11 w-full appearance-none rounded-[9px] border border-line bg-white px-3 text-sm"><option value="all">All visibility</option><option value="private">Private</option><option value="team">Team</option><option value="public">Public</option></select><SlidersHorizontal size={14} className="pointer-events-none absolute right-3 top-3.5 text-muted" /></label>
        <label><span className="sr-only">Order subjects by</span><select aria-label="Order subjects by" value={sort} onChange={(event) => setSort(event.target.value as Sort)} className="min-h-11 w-full rounded-[9px] border border-line bg-white px-3 text-sm"><option value="updated">Recently updated</option><option value="title">Title A–Z</option><option value="exams">Most exams</option></select></label>
        <label><span className="sr-only">Group subjects by</span><select aria-label="Group subjects by" value={group} onChange={(event) => setGroup(event.target.value as Group)} className="min-h-11 w-full rounded-[9px] border border-line bg-white px-3 text-sm"><option value="none">No grouping</option><option value="university">Group: institution</option><option value="visibility">Group: visibility</option></select></label>
        <div className="flex rounded-[9px] border border-line bg-white p-1 md:col-span-2 xl:col-span-1" role="group" aria-label="Subject view"><button type="button" onClick={() => setView("grid")} className={`grid size-8 flex-1 place-items-center rounded-[6px] xl:flex-none ${view === "grid" ? "bg-surface text-ink" : "text-muted"}`} aria-label="Grid view" aria-pressed={view === "grid"}><Grid2X2 size={15} /></button><button type="button" onClick={() => setView("list")} className={`grid size-8 flex-1 place-items-center rounded-[6px] xl:flex-none ${view === "list" ? "bg-surface text-ink" : "text-muted"}`} aria-label="List view" aria-pressed={view === "list"}><List size={16} /></button></div>
      </div>
      {visible.length ? (
        <div className="grid gap-7">{groups.map(([label, items]) => <section key={label}><div className={`mb-3 flex items-center gap-3 ${group === "none" ? "sr-only" : ""}`}><h2 className="text-sm font-semibold">{label}</h2><span className="text-xs text-muted">{items.length}</span><span className="h-px flex-1 bg-line" /></div><div className={view === "grid" ? "grid gap-4 md:grid-cols-2 2xl:grid-cols-3" : "grid gap-3"}>{items.map((subject) => <SubjectCard key={subject.id} subject={subject} examCount={examCounts[subject.id] ?? 0} compact={view === "list"} />)}</div></section>)}</div>
      ) : (
        <div className="grid min-h-[320px] place-items-center rounded-[14px] border border-dashed border-line bg-surface-raised p-8 text-center"><div><p className="font-semibold">{subjects.length ? "No matching subjects" : "Create your first subject"}</p><p className="mt-2 text-sm text-muted">{subjects.length ? "Try another search or clear a filter." : "Subjects keep related exams and classes together."}</p>{subjects.length ? <button type="button" onClick={() => { setQuery(""); setVisibility("all"); setGroup("none"); }} className="mt-5 text-sm font-semibold text-signal">Clear filters</button> : <Link href="/subjects/new" className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-[9px] bg-signal px-4 text-sm font-semibold text-white"><Plus size={16} /> New subject</Link>}</div></div>
      )}
    </PageFrame>
  );
}
