import { ClassDetail } from "@/features/classes/class-detail";

export default async function ClassPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  return <ClassDetail classId={classId} />;
}
