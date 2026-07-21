import { ArrowUpRight, FileText, MoreHorizontal } from "lucide-react";
import Link from "next/link";

import { StatusPill } from "@/components/ui/status-pill";
import type { Subject } from "@/features/subjects/types";

export function SubjectCard({ subject, examCount, compact = false }: { subject: Subject; examCount: number; compact?: boolean }) {
  return (
    <Link href={`/subjects/${subject.id}`} className={`group flex flex-col rounded-[14px] border border-line bg-white p-5 transition duration-200 ease-exam hover:-translate-y-0.5 hover:border-[#cfcfd5] hover:shadow-[0_16px_36px_rgba(13,13,13,0.06)] sm:p-6 ${compact ? "min-h-[190px] sm:grid sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-6" : "min-h-[250px]"}`}>
      <div className="flex items-start justify-between">
        <span className="grid size-10 place-items-center rounded-[10px] bg-contrast text-sm font-semibold text-contrast-ink">{subject.courseCode.slice(0, 2).toUpperCase()}</span>
        <button className="grid size-9 place-items-center rounded-[8px] text-muted opacity-0 transition hover:bg-surface group-hover:opacity-100" aria-label={`More options for ${subject.title}`} onClick={(event) => event.preventDefault()}><MoreHorizontal size={18} /></button>
      </div>
      <div className={compact ? "mt-5 sm:mt-0" : "mt-7"}>
        <div className="flex items-center gap-2"><StatusPill tone={subject.visibility === "team" ? "signal" : "neutral"}>{subject.visibility}</StatusPill><span className="text-[11px] text-muted">Updated {subject.updatedAt.toLowerCase()}</span></div>
        <h2 className="mt-3 text-[20px] font-semibold tracking-[-0.025em]">{subject.title}</h2>
        <p className="mt-1 text-sm text-muted">{subject.university} · {subject.courseCode}</p>
      </div>
      <div className={`mt-auto flex items-center justify-between border-t border-line pt-4 text-xs text-muted ${compact ? "sm:mt-0 sm:min-w-[180px] sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0" : ""}`}>
        <span className="flex items-center gap-1.5"><FileText size={14} /> {examCount} {examCount === 1 ? "exam" : "exams"}</span>
        <span className="flex items-center gap-1 font-semibold text-ink">Open subject <ArrowUpRight size={13} /></span>
      </div>
    </Link>
  );
}
