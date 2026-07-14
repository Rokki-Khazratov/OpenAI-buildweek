"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { Subject, SubjectInput } from "@/features/subjects/types";

const STORAGE_KEY = "examtwin.visual.subjects.v1";

function readSavedSubjects() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveSubjects(subjects: Subject[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(subjects));
  } catch {
    // The visual demo can continue in memory without browser storage.
  }
}

const initialSubjects: Subject[] = [
  {
    id: "quantum-physics",
    title: "Quantum Physics",
    university: "TU Wien",
    courseCode: "PHY-401",
    visibility: "private",
    targetExamDate: "2026-08-12",
    examCount: 2,
    completedMocks: 4,
    readiness: 68,
    updatedAt: "Today, 09:42",
  },
  {
    id: "algorithms",
    title: "Algorithms & Data Structures",
    university: "TU Wien",
    courseCode: "CS-301",
    visibility: "team",
    targetExamDate: "2026-09-04",
    examCount: 1,
    completedMocks: 2,
    readiness: 42,
    updatedAt: "Yesterday",
  },
  {
    id: "german-c1",
    title: "German C1",
    university: "ÖSD",
    courseCode: "C1",
    visibility: "private",
    targetExamDate: "2026-10-18",
    examCount: 1,
    completedMocks: 0,
    readiness: 18,
    updatedAt: "4 days ago",
  },
];

type DemoContextValue = {
  subjects: Subject[];
  addSubject: (input: SubjectInput) => Subject;
  updateSubject: (id: string, input: SubjectInput) => void;
  removeSubject: (id: string) => void;
  resetDemo: () => void;
};

const DemoContext = createContext<DemoContextValue | null>(null);

function createId(title: string) {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${slug || "subject"}-${Date.now().toString(36)}`;
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = readSavedSubjects();
      if (!saved) return;
      try {
        setSubjects(JSON.parse(saved) as Subject[]);
      } catch {
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {
          // Ignore unavailable browser storage and use seeded subjects.
        }
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function replaceSubjects(next: Subject[]) {
    saveSubjects(next);
    setSubjects(next);
  }

  const value = useMemo<DemoContextValue>(
    () => ({
      subjects,
      addSubject(input) {
        const subject: Subject = {
          id: createId(input.title),
          ...input,
          examCount: 0,
          completedMocks: 0,
          readiness: 0,
          updatedAt: "Just now",
        };
        replaceSubjects([subject, ...subjects]);
        return subject;
      },
      updateSubject(id, input) {
        replaceSubjects(subjects.map((subject) =>
          subject.id === id ? { ...subject, ...input, updatedAt: "Just now" } : subject,
        ));
      },
      removeSubject(id) {
        replaceSubjects(subjects.filter((subject) => subject.id !== id));
      },
      resetDemo() {
        replaceSubjects(initialSubjects);
      },
    }),
    [subjects],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error("useDemo must be used inside DemoProvider");
  return context;
}
