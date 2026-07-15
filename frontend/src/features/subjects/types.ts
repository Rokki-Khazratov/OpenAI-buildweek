export type SubjectVisibility = "private" | "team" | "public";

export type Subject = {
  id: string;
  title: string;
  university: string;
  courseCode: string;
  visibility: SubjectVisibility;
  updatedAt: string;
};

export type SubjectInput = Pick<
  Subject,
  "title" | "university" | "courseCode" | "visibility"
>;
