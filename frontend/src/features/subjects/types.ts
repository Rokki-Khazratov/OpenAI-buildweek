export type SubjectVisibility = "private" | "team" | "public";

export type Subject = {
  id: string;
  title: string;
  university: string;
  courseCode: string;
  visibility: SubjectVisibility;
  targetExamDate: string;
  examCount: number;
  completedMocks: number;
  readiness: number;
  updatedAt: string;
};

export type SubjectInput = Pick<
  Subject,
  "title" | "university" | "courseCode" | "visibility" | "targetExamDate"
>;
