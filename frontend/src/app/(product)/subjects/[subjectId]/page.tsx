import { SubjectDetail } from "@/features/subjects/subject-detail";

export default async function SubjectPage({ params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await params;
  return <SubjectDetail subjectId={subjectId} />;
}
