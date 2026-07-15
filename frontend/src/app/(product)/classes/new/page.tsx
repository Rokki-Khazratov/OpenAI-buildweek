import { PageFrame } from "@/components/layout/page-frame";
import { ClassForm } from "@/features/classes/class-form";

export default function NewClassPage() {
  return <PageFrame eyebrow="Classes / New" title="Create a class" description="Share a subject or selected exams with a focused study group."><ClassForm /></PageFrame>;
}
