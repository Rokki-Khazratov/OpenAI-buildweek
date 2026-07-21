"use client";

import {
  ArrowRight,
  BookCopy,
  Check,
  Copy,
  Library,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { PageFrame } from "@/components/layout/page-frame";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { useDemo } from "@/features/demo/demo-provider";

import {
  clonePublication,
  listPublications,
  type LibraryPublication,
} from "./api";

const demoItems: LibraryPublication[] = [
  {
    id: "demo-algorithms",
    source_exam_id: null,
    title: "Algorithms final",
    description: "A verified final covering graphs, dynamic programming, and complexity.",
    subject_title: "Algorithms & Data Structures",
    university: "TU Wien",
    course_code: "CS-301",
    exam_type: "Written final",
    language: "en",
    blueprint: {
      sections: [
        { id: "analysis", title: "Analysis", question_type: "Proof", question_count: 3, duration_minutes: 35, points: 30, skills: ["complexity"], confidence: 0.96 },
        { id: "design", title: "Design", question_type: "Problems", question_count: 3, duration_minutes: 55, points: 50, skills: ["graphs", "dynamic-programming"], confidence: 0.92 },
        { id: "short", title: "Complexity", question_type: "Short answer", question_count: 4, duration_minutes: 30, points: 20, skills: ["complexity"], confidence: 0.94 },
      ],
      skill_taxonomy: [
        { id: "graphs", label: "Graph algorithms" },
        { id: "dynamic-programming", label: "Dynamic programming" },
        { id: "complexity", label: "Complexity analysis" },
      ],
      overall_confidence: 0.94,
    },
    rules: { durationMinutes: 120, totalPoints: 100, passPercentage: 50 },
    scenario: { mode: "full_exam", difficulty: "matched" },
    source_configuration_version: 4,
    blueprint_version: 3,
    rights_note: "Shared for private study use.",
    publisher_name: "ExamTwin verified",
    clone_count: 18,
    is_published: true,
    published_at: "2026-07-19T10:00:00Z",
  },
];

function confidence(value: number) {
  return `${Math.round(value * 100)}% confidence`;
}

export function LibraryWorkspace() {
  const router = useRouter();
  const { reload } = useDemo();
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const [items, setItems] = useState<LibraryPublication[]>(demoMode ? demoItems : []);
  const [selected, setSelected] = useState<LibraryPublication | null>(null);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("");
  const [examType, setExamType] = useState("");
  const [loading, setLoading] = useState(!demoMode);
  const [cloning, setCloning] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (demoMode) return;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void listPublications({ query, language, examType })
        .then((page) => setItems(page.items))
        .catch((reason: unknown) =>
          setError(reason instanceof Error ? reason.message : "The Library could not be loaded."),
        )
        .finally(() => setLoading(false));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [demoMode, examType, language, query]);

  const filteredDemo = useMemo(() => {
    if (!demoMode) return items;
    return items.filter((item) => {
      const searchable = `${item.title} ${item.subject_title} ${item.university} ${item.course_code}`.toLowerCase();
      return (
        searchable.includes(query.toLowerCase()) &&
        (!language || item.language === language) &&
        (!examType || item.exam_type === examType)
      );
    });
  }, [demoMode, examType, items, language, query]);

  async function clone(item: LibraryPublication) {
    if (demoMode) {
      setNotice("Demo clone verified. Connect the backend to create a private subject.");
      return;
    }
    setCloning(item.id);
    setError(null);
    try {
      const result = await clonePublication(item.id);
      await reload();
      router.push(`/subjects/${result.subject_id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The private copy could not be created.");
    } finally {
      setCloning(null);
    }
  }

  return (
    <PageFrame
      eyebrow="Community contracts"
      title="Library"
      description="Discover a verified Exam blueprint, inspect its provenance, then clone an independent private copy."
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <div className="grid gap-3 rounded-[14px] border border-line bg-surface-raised p-3 sm:grid-cols-[minmax(0,1fr)_150px_180px]">
            <label className="flex min-h-11 items-center gap-2 rounded-[9px] border border-line bg-white px-3">
              <Search size={16} className="text-muted" />
              <input
                aria-label="Search Library"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search exam, subject, institution…"
                className="min-w-0 flex-1 bg-transparent text-sm outline-hidden placeholder:text-muted"
              />
            </label>
            <label className="relative">
              <span className="sr-only">Language</span>
              <select value={language} onChange={(event) => setLanguage(event.target.value)} className="min-h-11 w-full appearance-none rounded-[9px] border border-line bg-white px-3 text-sm">
                <option value="">All languages</option>
                <option value="en">English</option>
                <option value="de">German</option>
              </select>
              <SlidersHorizontal size={14} className="pointer-events-none absolute right-3 top-3.5 text-muted" />
            </label>
            <label>
              <span className="sr-only">Exam type</span>
              <input value={examType} onChange={(event) => setExamType(event.target.value)} placeholder="Exam type" className="min-h-11 w-full rounded-[9px] border border-line bg-white px-3 text-sm outline-hidden" />
            </label>
          </div>

          {error && <p role="alert" className="mt-4 rounded-[10px] border border-danger/30 bg-red-50 p-4 text-sm text-danger">{error}</p>}
          {notice && <p role="status" className="mt-4 rounded-[10px] border border-signal/20 bg-signal-soft p-4 text-sm text-signal">{notice}</p>}
          {loading ? (
            <div className="mt-5 rounded-[14px] border border-line p-8 text-sm text-muted">Loading verified exams…</div>
          ) : filteredDemo.length ? (
            <div className="mt-5 grid gap-3">
              {filteredDemo.map((item) => (
                <button key={item.id} onClick={() => setSelected(item)} className={`group w-full rounded-[14px] border bg-white p-5 text-left transition hover:border-signal/40 ${selected?.id === item.id ? "border-signal shadow-[0_12px_32px_rgba(46,46,255,0.08)]" : "border-line"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-11 place-items-center rounded-[11px] bg-signal-soft text-signal"><Library size={19} /></span>
                      <div><p className="text-base font-semibold">{item.title}</p><p className="mt-1 text-xs text-muted">{item.subject_title} · {item.university || "Independent"}</p></div>
                    </div>
                    <StatusPill tone="success"><ShieldCheck size={12} /> Verified</StatusPill>
                  </div>
                  <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted">{item.description || "No description."}</p>
                  <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4 text-xs text-muted">
                    <span>{item.blueprint.sections.length} blueprint sections</span>
                    <span>{confidence(item.blueprint.overall_confidence)}</span>
                    <span>{item.clone_count} private clones</span>
                    <ArrowRight size={15} className="ml-auto transition group-hover:translate-x-1 group-hover:text-signal" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-5 grid min-h-[300px] place-items-center rounded-[14px] border border-dashed border-line text-center"><div><BookCopy size={24} className="mx-auto text-muted" /><p className="mt-4 text-sm font-semibold">No matching publications</p><p className="mt-1 text-xs text-muted">Try a broader subject or clear a filter.</p></div></div>
          )}
        </div>

        <aside className="h-fit rounded-[14px] border border-line bg-white p-5 xl:sticky xl:top-24">
          {selected ? (
            <>
              <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-signal">Exam contract</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">{selected.title}</h2></div><button aria-label="Close preview" onClick={() => setSelected(null)} className="rounded-md p-2 text-muted hover:bg-surface"><X size={16} /></button></div>
              <div className="mt-6 border-l-2 border-signal/25 pl-4">
                {[`By ${selected.publisher_name}`, `Blueprint v${selected.blueprint_version} · config v${selected.source_configuration_version}`, `Published ${new Date(selected.published_at).toLocaleDateString("en-GB")}`].map((line) => <p key={line} className="relative mb-4 text-xs text-muted before:absolute before:-left-[21px] before:top-1 before:size-2 before:rounded-full before:bg-signal">{line}</p>)}
              </div>
              <div className="mt-5 divide-y divide-line rounded-[11px] border border-line">
                {selected.blueprint.sections.map((section, index) => <div key={section.id} className="flex gap-3 p-3.5"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-signal-soft font-mono text-[10px] text-signal">{index + 1}</span><div className="min-w-0"><p className="text-sm font-medium">{section.title}</p><p className="mt-1 text-xs text-muted">{section.question_count} questions · {section.points} pts · {section.duration_minutes} min</p></div></div>)}
              </div>
              <p className="mt-4 rounded-[9px] bg-surface p-3 text-xs leading-5 text-muted"><strong className="font-semibold text-ink">Rights.</strong> {selected.rights_note}</p>
              <Button className="mt-5 w-full" onClick={() => void clone(selected)} disabled={cloning === selected.id}><Copy size={15} /> {cloning === selected.id ? "Creating private copy…" : "Clone private copy"}</Button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted"><Check size={12} className="text-success" /> No source files or student data are copied</p>
            </>
          ) : (
            <div className="grid min-h-[360px] place-items-center text-center"><div className="max-w-[240px]"><span className="mx-auto grid size-12 place-items-center rounded-[12px] bg-surface text-muted"><Library size={20} /></span><p className="mt-4 text-sm font-semibold">Select an Exam</p><p className="mt-2 text-xs leading-5 text-muted">Inspect the blueprint version, provenance, rights, and exact clone boundary.</p></div></div>
          )}
        </aside>
      </div>
    </PageFrame>
  );
}
