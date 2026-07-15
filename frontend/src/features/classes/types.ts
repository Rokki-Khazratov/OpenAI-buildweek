export type ClassExamScope = "subject" | "selected";

export type StudyClass = {
  id: string;
  subjectId: string;
  name: string;
  description: string;
  examScope: ClassExamScope;
  examIds: string[];
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type StudyClassInput = Pick<
  StudyClass,
  "subjectId" | "name" | "description" | "examScope" | "examIds"
>;
