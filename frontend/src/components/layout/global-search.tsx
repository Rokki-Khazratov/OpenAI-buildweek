"use client";

import { Command, FileText, GraduationCap, Search, UsersRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { navigation } from "@/data/navigation";
import { useDemo } from "@/features/demo/demo-provider";

type SearchResult = {
  id: string;
  label: string;
  meta: string;
  href: string;
  icon: typeof FileText;
};

export function GlobalSearch() {
  const router = useRouter();
  const { subjects, exams, classes } = useDemo();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const results = useMemo<SearchResult[]>(() => {
    const term = query.trim().toLowerCase();
    const subjectResults = subjects.map((subject) => ({
      id: `subject-${subject.id}`,
      label: subject.title,
      meta: `${subject.courseCode} · Subject`,
      href: `/subjects/${subject.id}`,
      icon: GraduationCap,
    }));
    const routeResults = navigation.map((item) => ({
      id: `route-${item.href}`,
      label: item.label,
      meta: "Page",
      href: item.href,
      icon: item.label === "Classes" ? UsersRound : FileText,
    }));
    const examResults = exams.map((exam) => ({
      id: `exam-${exam.id}`,
      label: exam.title,
      meta: `${subjects.find((subject) => subject.id === exam.subjectId)?.title ?? "Exam"} · Exam`,
      href: `/exams/${exam.id}`,
      icon: FileText,
    }));
    const classResults = classes.map((studyClass) => ({
      id: `class-${studyClass.id}`,
      label: studyClass.name,
      meta: `${subjects.find((subject) => subject.id === studyClass.subjectId)?.title ?? "Class"} · Class`,
      href: `/classes/${studyClass.id}`,
      icon: UsersRound,
    }));
    return [...subjectResults, ...examResults, ...classResults, ...routeResults]
      .filter((item) => !term || `${item.label} ${item.meta}`.toLowerCase().includes(term))
      .slice(0, 8);
  }, [classes, exams, query, subjects]);

  function choose(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="ml-2 grid size-10 place-items-center rounded-[9px] text-muted hover:bg-surface sm:hidden" aria-label="Search">
        <Search size={18} />
      </button>
      <button onClick={() => setOpen(true)} className="ml-3 hidden min-h-9 w-full max-w-[380px] items-center gap-2.5 rounded-[9px] border border-line bg-surface px-3 text-left text-sm text-muted transition hover:border-[#a9a9b0] sm:flex lg:ml-0">
        <Search size={16} />
        <span className="flex-1">Search</span>
        <span className="flex items-center gap-1 rounded border border-line bg-white px-1.5 py-0.5 font-mono text-[10px]"><Command size={10} />K</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex justify-center bg-black/35 px-4 pt-[12vh] backdrop-blur-[3px]" onMouseDown={() => setOpen(false)}>
          <section role="dialog" aria-modal="true" aria-label="Search ExamTwin" className="h-fit w-full max-w-[620px] overflow-hidden rounded-[15px] border border-line bg-canvas shadow-float" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search size={18} className="text-muted" />
              <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Subjects, pages, exams or classes" className="min-h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted" />
              <button onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-[8px] text-muted hover:bg-surface" aria-label="Close search"><X size={16} /></button>
            </div>
            <div className="max-h-[430px] overflow-y-auto p-2">
              {results.length ? results.map((result) => {
                const Icon = result.icon;
                return <button key={result.id} onClick={() => choose(result.href)} className="flex min-h-12 w-full items-center gap-3 rounded-[10px] px-3 text-left transition hover:bg-surface"><span className="grid size-8 place-items-center rounded-[8px] bg-surface text-muted"><Icon size={15} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{result.label}</span><span className="mt-0.5 block text-xs text-muted">{result.meta}</span></span></button>;
              }) : <div className="px-4 py-12 text-center"><p className="text-sm font-medium">Nothing found</p><p className="mt-1 text-xs text-muted">Try a subject title or a page name.</p></div>}
            </div>
            <footer className="border-t border-line px-4 py-2.5 text-[11px] text-muted">Press Esc to close</footer>
          </section>
        </div>
      )}
    </>
  );
}
