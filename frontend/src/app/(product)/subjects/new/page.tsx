import { PageFrame } from "@/components/layout/page-frame";
import { SubjectForm } from "@/features/subjects/subject-form";

export default function NewSubjectPage() {
  return <PageFrame eyebrow="Subjects / New" title="Create a subject" description="Start with the course container. You can add several exams and their source material next."><SubjectForm /></PageFrame>;
}
