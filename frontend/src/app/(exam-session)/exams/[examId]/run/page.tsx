import { ExamRun } from "@/features/exams/exam-run";

export default async function RunExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  return <ExamRun examId={examId} />;
}
