import { ExamRun } from "@/features/exams/exam-run";

export default async function RunExamPage({
  params,
  searchParams,
}: {
  params: Promise<{ examId: string }>;
  searchParams: Promise<{ mode?: string; attempt?: string }>;
}) {
  const { examId } = await params;
  const query = await searchParams;
  return (
    <ExamRun
      examId={examId}
      generationMode={query.mode === "adaptive" ? "adaptive" : "full_exam"}
      requestedAttempt={query.attempt}
    />
  );
}
