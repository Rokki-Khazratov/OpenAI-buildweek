"use client";

import { useParams } from "next/navigation";

import { PageFrame } from "@/components/layout/page-frame";
import { useDemo } from "@/features/demo/demo-provider";
import { ExamForm } from "@/features/exams/exam-form";

export default function EditExamPage() {
  const { examId } = useParams<{ examId: string }>();
  const { exams, loading } = useDemo();
  const exam = exams.find((item) => item.id === examId);
  if (loading) return <div className="p-10 text-sm text-muted">Loading exam…</div>;
  if (!exam) return <div className="p-10 text-sm text-muted">Exam not found or unavailable.</div>;
  return <PageFrame eyebrow="Exams / Edit" title={`Edit ${exam.title}`}><ExamForm exam={exam} /></PageFrame>;
}
