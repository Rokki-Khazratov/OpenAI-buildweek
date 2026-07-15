"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { StudyClass, StudyClassInput } from "@/features/classes/types";
import type { Exam, ExamAttempt, ExamInput } from "@/features/exams/types";
import type { Subject, SubjectInput } from "@/features/subjects/types";

const SUBJECTS_STORAGE_KEY = "examtwin.visual.subjects.v1";
const CLASSES_STORAGE_KEY = "examtwin.visual.classes.v1";
const EXAMS_STORAGE_KEY = "examtwin.visual.exams.v1";

function readSavedSubjects() {
  try {
    return window.localStorage.getItem(SUBJECTS_STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveSubjects(subjects: Subject[]) {
  try {
    window.localStorage.setItem(SUBJECTS_STORAGE_KEY, JSON.stringify(subjects));
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
    updatedAt: "Today, 09:42",
  },
  {
    id: "algorithms",
    title: "Algorithms & Data Structures",
    university: "TU Wien",
    courseCode: "CS-301",
    visibility: "team",
    updatedAt: "Yesterday",
  },
  {
    id: "german-c1",
    title: "German C1",
    university: "ÖSD",
    courseCode: "C1",
    visibility: "private",
    updatedAt: "4 days ago",
  },
];

const initialExams: Exam[] = [
  {
    id: "quantum-final-2025",
    subjectId: "quantum-physics",
    title: "Final exam 2025",
    description: "Written final covering wave mechanics, operators, angular momentum, and perturbation theory.",
    examType: "Written final",
    language: "en",
    targetDate: "2026-08-12",
    status: "ready",
    sources: [
      { id: "q-source-1", name: "Final exam 2024.pdf", kind: "past_exam", size: "2.4 MB", status: "ready" },
      { id: "q-source-2", name: "Official formula sheet.pdf", kind: "rubric", size: "680 KB", status: "ready" },
      { id: "q-source-3", name: "Lecture notes — chapters 5–9.pdf", kind: "notes", size: "8.1 MB", status: "ready" },
    ],
    blueprint: [
      { id: "q-section-1", title: "Core concepts", questionType: "Short answer", questionCount: 5, durationMinutes: 25, points: 20 },
      { id: "q-section-2", title: "Derivations", questionType: "Worked problems", questionCount: 3, durationMinutes: 45, points: 45 },
      { id: "q-section-3", title: "Applications", questionType: "Multi-step problems", questionCount: 2, durationMinutes: 30, points: 35 },
    ],
    rules: { durationMinutes: 100, totalPoints: 100, passPercentage: 50, penalty: "No negative marking", allowedMaterials: "Official formula sheet and non-programmable calculator", gradingNotes: "Show intermediate steps. Unsupported answers receive no method points." },
    scenario: { mode: "full_exam", difficulty: "matched", instructions: "Reproduce the structure and pacing of the final. Prefer new numerical values and grounded variants of the source problems." },
    attempts: [
      { id: "quantum-attempt-1", examId: "quantum-final-2025", score: 68, maxScore: 100, durationMinutes: 96, completedAt: "13 July 2026, 18:42", feedback: "Strong conceptual recall. Revisit angular momentum derivations and time allocation in the final section.", answers: {} },
    ],
    updatedAt: "Today, 09:42",
  },
  {
    id: "quantum-midterm-2025",
    subjectId: "quantum-physics",
    title: "Midterm 2025",
    description: "Compact midterm on wave functions, observables, and one-dimensional systems.",
    examType: "Midterm",
    language: "en",
    targetDate: "2026-07-29",
    status: "draft",
    sources: [{ id: "qm-source-1", name: "Midterm archive.pdf", kind: "past_exam", size: "1.1 MB", status: "needs_review" }],
    blueprint: [
      { id: "qm-section-1", title: "Theory", questionType: "Short answer", questionCount: 4, durationMinutes: 20, points: 20 },
      { id: "qm-section-2", title: "Problems", questionType: "Calculations", questionCount: 3, durationMinutes: 40, points: 40 },
    ],
    rules: { durationMinutes: 60, totalPoints: 60, passPercentage: 50, penalty: "No negative marking", allowedMaterials: "One handwritten A4 sheet", gradingNotes: "Units are required for all numerical answers." },
    scenario: { mode: "full_exam", difficulty: "matched", instructions: "Keep the mock concise and balanced between theory and calculation." },
    attempts: [],
    updatedAt: "Yesterday",
  },
  {
    id: "algorithms-final",
    subjectId: "algorithms",
    title: "Algorithms final",
    description: "Final examination covering graph algorithms, dynamic programming, and complexity.",
    examType: "Written final",
    language: "en",
    targetDate: "2026-09-04",
    status: "ready",
    sources: [
      { id: "a-source-1", name: "Final 2025.pdf", kind: "past_exam", size: "1.8 MB", status: "ready" },
      { id: "a-source-2", name: "Grading rubric.pdf", kind: "rubric", size: "420 KB", status: "ready" },
    ],
    blueprint: [
      { id: "a-section-1", title: "Analysis", questionType: "Proof and analysis", questionCount: 3, durationMinutes: 35, points: 30 },
      { id: "a-section-2", title: "Design", questionType: "Algorithm design", questionCount: 3, durationMinutes: 55, points: 50 },
      { id: "a-section-3", title: "Complexity", questionType: "Short answer", questionCount: 4, durationMinutes: 30, points: 20 },
    ],
    rules: { durationMinutes: 120, totalPoints: 100, passPercentage: 50, penalty: "Incorrect complexity claims may lose method points", allowedMaterials: "No materials", gradingNotes: "State assumptions and prove correctness for designed algorithms." },
    scenario: { mode: "adaptive", difficulty: "matched", instructions: "Prioritize dynamic programming and graph traversal while preserving the official section weights." },
    attempts: [],
    updatedAt: "2 days ago",
  },
];

const initialClasses: StudyClass[] = [
  {
    id: "algorithms-study-group",
    subjectId: "algorithms",
    name: "Algorithms study group",
    description: "Weekly preparation sessions for the final exam.",
    examScope: "subject",
    examIds: [],
    memberCount: 8,
    createdAt: "8 July 2026",
    updatedAt: "Yesterday",
  },
  {
    id: "quantum-final-review",
    subjectId: "quantum-physics",
    name: "Quantum final review",
    description: "A focused class for the 2025 final exam blueprint.",
    examScope: "selected",
    examIds: ["quantum-final-2025"],
    memberCount: 4,
    createdAt: "11 July 2026",
    updatedAt: "Today, 08:15",
  },
];

type DemoContextValue = {
  subjects: Subject[];
  exams: Exam[];
  classes: StudyClass[];
  addSubject: (input: SubjectInput) => Subject;
  updateSubject: (id: string, input: SubjectInput) => void;
  removeSubject: (id: string) => void;
  addExam: (input: ExamInput) => Exam;
  updateExam: (id: string, input: ExamInput) => void;
  removeExam: (id: string) => void;
  addAttempt: (examId: string, attempt: ExamAttempt) => void;
  addClass: (input: StudyClassInput) => StudyClass;
  updateClass: (id: string, input: StudyClassInput) => void;
  removeClass: (id: string) => void;
  resetDemo: () => void;
};

const DemoContext = createContext<DemoContextValue | null>(null);

function createId(title: string, fallback = "subject") {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${slug || fallback}-${Date.now().toString(36)}`;
}

function readSavedClasses() {
  try {
    return window.localStorage.getItem(CLASSES_STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveClasses(classes: StudyClass[]) {
  try {
    window.localStorage.setItem(CLASSES_STORAGE_KEY, JSON.stringify(classes));
  } catch {
    // The visual demo can continue in memory without browser storage.
  }
}

function readSavedExams() {
  try {
    return window.localStorage.getItem(EXAMS_STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveExams(exams: Exam[]) {
  try {
    window.localStorage.setItem(EXAMS_STORAGE_KEY, JSON.stringify(exams));
  } catch {
    // The visual demo can continue in memory without browser storage.
  }
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);
  const [exams, setExams] = useState<Exam[]>(initialExams);
  const [classes, setClasses] = useState<StudyClass[]>(initialClasses);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = readSavedSubjects();
      if (!saved) return;
      try {
        setSubjects(JSON.parse(saved) as Subject[]);
      } catch {
        try {
          window.localStorage.removeItem(SUBJECTS_STORAGE_KEY);
        } catch {
          // Ignore unavailable browser storage and use seeded subjects.
        }
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = readSavedExams();
      if (!saved) return;
      try {
        setExams(JSON.parse(saved) as Exam[]);
      } catch {
        try {
          window.localStorage.removeItem(EXAMS_STORAGE_KEY);
        } catch {
          // Ignore unavailable browser storage and use seeded exams.
        }
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = readSavedClasses();
      if (!saved) return;
      try {
        setClasses(JSON.parse(saved) as StudyClass[]);
      } catch {
        try {
          window.localStorage.removeItem(CLASSES_STORAGE_KEY);
        } catch {
          // Ignore unavailable browser storage and use seeded classes.
        }
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function replaceSubjects(next: Subject[]) {
    saveSubjects(next);
    setSubjects(next);
  }

  function replaceClasses(next: StudyClass[]) {
    saveClasses(next);
    setClasses(next);
  }

  function replaceExams(next: Exam[]) {
    saveExams(next);
    setExams(next);
  }

  const value = useMemo<DemoContextValue>(
    () => ({
      subjects,
      exams,
      classes,
      addSubject(input) {
        const subject: Subject = {
          id: createId(input.title),
          ...input,
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
        replaceExams(exams.filter((exam) => exam.subjectId !== id));
        replaceClasses(classes.filter((studyClass) => studyClass.subjectId !== id));
      },
      addExam(input) {
        const exam: Exam = {
          id: createId(input.title, "exam"),
          ...input,
          status: input.blueprint.length > 0 && input.sources.length > 0 ? "ready" : "draft",
          attempts: [],
          updatedAt: "Just now",
        };
        replaceExams([exam, ...exams]);
        return exam;
      },
      updateExam(id, input) {
        replaceExams(exams.map((exam) => exam.id === id ? {
          ...exam,
          ...input,
          status: input.blueprint.length > 0 && input.sources.length > 0 ? "ready" : "draft",
          updatedAt: "Just now",
        } : exam));
      },
      removeExam(id) {
        replaceExams(exams.filter((exam) => exam.id !== id));
        replaceClasses(classes.map((studyClass) => ({
          ...studyClass,
          examIds: studyClass.examIds.filter((examId) => examId !== id),
        })));
      },
      addAttempt(examId, attempt) {
        replaceExams(exams.map((exam) => exam.id === examId ? {
          ...exam,
          attempts: [attempt, ...exam.attempts],
          updatedAt: "Just now",
        } : exam));
      },
      addClass(input) {
        const studyClass: StudyClass = {
          id: createId(input.name, "class"),
          ...input,
          memberCount: 1,
          createdAt: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
          updatedAt: "Just now",
        };
        replaceClasses([studyClass, ...classes]);
        return studyClass;
      },
      updateClass(id, input) {
        replaceClasses(classes.map((studyClass) =>
          studyClass.id === id ? { ...studyClass, ...input, updatedAt: "Just now" } : studyClass,
        ));
      },
      removeClass(id) {
        replaceClasses(classes.filter((studyClass) => studyClass.id !== id));
      },
      resetDemo() {
        replaceSubjects(initialSubjects);
        replaceExams(initialExams);
        replaceClasses(initialClasses);
      },
    }),
    [subjects, exams, classes],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error("useDemo must be used inside DemoProvider");
  return context;
}
