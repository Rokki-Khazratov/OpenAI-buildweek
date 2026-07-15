import { ExamStatistics } from "@/features/exams/exam-statistics";

export default async function ExamStatisticsPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  return <ExamStatistics examId={examId} />;
}
