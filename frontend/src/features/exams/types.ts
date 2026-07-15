export type ExamStatus = "draft" | "ready";
export type ExamLanguage = "en" | "de" | "ru" | "other";
export type SourceKind = "past_exam" | "rubric" | "notes" | "solutions" | "syllabus" | "other";
export type SourceStatus = "ready" | "processing" | "needs_review";
export type MockMode = "full_exam" | "section_only" | "adaptive";

export type ExamSource = {
  id: string;
  name: string;
  kind: SourceKind;
  size: string;
  status: SourceStatus;
};

export type BlueprintSection = {
  id: string;
  title: string;
  questionType: string;
  questionCount: number;
  durationMinutes: number;
  points: number;
};

export type ExamRules = {
  durationMinutes: number;
  totalPoints: number;
  passPercentage: number;
  penalty: string;
  allowedMaterials: string;
  gradingNotes: string;
};

export type ExamScenario = {
  mode: MockMode;
  difficulty: "matched" | "easier" | "harder";
  instructions: string;
};

export type ExamAttempt = {
  id: string;
  examId: string;
  score: number;
  maxScore: number;
  durationMinutes: number;
  completedAt: string;
  feedback: string;
  answers: Record<string, string>;
};

export type Exam = {
  id: string;
  subjectId: string;
  title: string;
  description: string;
  examType: string;
  language: ExamLanguage;
  targetDate: string;
  status: ExamStatus;
  sources: ExamSource[];
  blueprint: BlueprintSection[];
  rules: ExamRules;
  scenario: ExamScenario;
  attempts: ExamAttempt[];
  updatedAt: string;
};

export type ExamInput = Pick<
  Exam,
  "subjectId" | "title" | "description" | "examType" | "language" | "targetDate" | "sources" | "blueprint" | "rules" | "scenario"
>;
