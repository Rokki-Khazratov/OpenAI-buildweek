import { ExamDetail } from "@/features/exams/exam-detail";

export default async function ExamPage({ params, searchParams }: { params: Promise<{ examId: string }>; searchParams: Promise<{ tab?: string; upload?: string }> }) {
  const { examId } = await params;
  const { tab, upload } = await searchParams;
  const initialTab = ["Data", "Blueprint", "Scenario", "Rules", "History"].find((item) => item.toLowerCase() === tab?.toLowerCase()) as "Data" | "Blueprint" | "Scenario" | "Rules" | "History" | undefined;
  return <ExamDetail examId={examId} initialTab={initialTab} uploadPartial={upload === "partial"} />;
}
