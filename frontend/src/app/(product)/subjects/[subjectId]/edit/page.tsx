"use client";

import { useParams } from "next/navigation";

import { PageFrame } from "@/components/layout/page-frame";
import { useDemo } from "@/features/demo/demo-provider";
import { SubjectForm } from "@/features/subjects/subject-form";

export default function EditSubjectPage() {
  const params = useParams<{ subjectId: string }>();
  const { subjects } = useDemo();
  const subject = subjects.find((item) => item.id === params.subjectId);
  if (!subject) return <div className="p-10 text-sm text-muted">Subject not found.</div>;
  return <PageFrame eyebrow="Subjects / Edit" title={`Edit ${subject.title}`} description="Changes apply to this subject container and its shared metadata."><SubjectForm subject={subject} /></PageFrame>;
}
