import { Suspense } from "react";

import { PageFrame } from "@/components/layout/page-frame";
import { ExamForm } from "@/features/exams/exam-form";

export default function NewExamPage() {
  return <PageFrame eyebrow="Exams / New" title="Create an Exam" description="Define the target, attach its evidence, verify the blueprint, and set simulation rules."><Suspense fallback={<div className="min-h-[500px] rounded-[14px] border border-line bg-white" />}><ExamForm /></Suspense></PageFrame>;
}
