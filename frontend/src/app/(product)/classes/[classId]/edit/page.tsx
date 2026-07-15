"use client";

import { useParams } from "next/navigation";

import { PageFrame } from "@/components/layout/page-frame";
import { ClassForm } from "@/features/classes/class-form";
import { useDemo } from "@/features/demo/demo-provider";

export default function EditClassPage() {
  const params = useParams<{ classId: string }>();
  const { classes } = useDemo();
  const studyClass = classes.find((item) => item.id === params.classId);
  if (!studyClass) return <div className="p-10 text-sm text-muted">Class not found.</div>;
  return <PageFrame eyebrow="Classes / Edit" title={`Edit ${studyClass.name}`}><ClassForm studyClass={studyClass} /></PageFrame>;
}
