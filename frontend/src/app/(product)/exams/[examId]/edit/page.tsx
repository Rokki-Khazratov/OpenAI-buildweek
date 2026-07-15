"use client";

import { useParams } from "next/navigation";

import { PageFrame } from "@/components/layout/page-frame";
import { useDemo } from "@/features/demo/demo-provider";
import { ExamForm } from "@/features/exams/exam-form";

export default function EditExamPage() {
  const { examId } = useParams<{ examId: string }>();
  const { exams } = useDemo();
  const exam = exams.find((item) => item.id === examId);
  if (!exam) return <div className="p-10 text-sm text-muted">Exam not found.</div>;
  return <PageFrame eyebrow="Exams / Edit" title={`Edit ${exam.title}`}><ExamForm exam={exam} /></PageFrame>;
}
