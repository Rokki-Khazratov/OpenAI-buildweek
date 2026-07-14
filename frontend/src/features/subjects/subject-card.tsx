import { ArrowUpRight, CalendarDays, FileText, MoreHorizontal } from "lucide-react";
import Link from "next/link";

import { StatusPill } from "@/components/ui/status-pill";
import type { Subject } from "@/features/subjects/types";

export function SubjectCard({ subject }: { subject: Subject }) {
  const reviewDate = new Date("2026-07-14T00:00:00Z").getTime();
  const days = Math.max(
    0,
    Math.ceil((new Date(subject.targetExamDate).getTime() - reviewDate) / 86_400_000),
  );
  return (
    <Link href={`/subjects/${subject.id}`} className="group flex min-h-[250px] flex-col rounded-[14px] border border-line bg-white p-5 transition duration-200 ease-exam hover:-translate-y-0.5 hover:border-[#cfcfd5] hover:shadow-[0_16px_36px_rgba(13,13,13,0.06)] sm:p-6">
      <div className="flex items-start justify-between">
        <span className="grid size-10 place-items-center rounded-[10px] bg-contrast text-sm font-semibold text-contrast-ink">{subject.courseCode.slice(0, 2).toUpperCase()}</span>
        <button className="grid size-9 place-items-center rounded-[8px] text-muted opacity-0 transition hover:bg-surface group-hover:opacity-100" aria-label={`More options for ${subject.title}`} onClick={(event) => event.preventDefault()}><MoreHorizontal size={18} /></button>
      </div>
      <div className="mt-7">
        <div className="flex items-center gap-2"><StatusPill tone={subject.visibility === "team" ? "signal" : "neutral"}>{subject.visibility}</StatusPill><span className="text-[11px] text-muted">Updated {subject.updatedAt.toLowerCase()}</span></div>
        <h2 className="mt-3 text-[20px] font-semibold tracking-[-0.025em]">{subject.title}</h2>
        <p className="mt-1 text-sm text-muted">{subject.university} · {subject.courseCode}</p>
      </div>
      <div className="mt-auto grid grid-cols-2 gap-3 border-t border-line pt-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><FileText size={14} /> {subject.examCount} {subject.examCount === 1 ? "exam" : "exams"}</span>
        <span className="flex items-center justify-end gap-1.5"><CalendarDays size={14} /> {days} days</span>
      </div>
      <span className="mt-4 flex items-center justify-between text-xs font-semibold"><span>Readiness</span><span className="flex items-center gap-1 text-signal">{subject.readiness}% <ArrowUpRight size={13} /></span></span>
      <span className="mt-2 h-1 overflow-hidden rounded-full bg-surface"><span className="block h-full rounded-full bg-signal" style={{ width: `${subject.readiness}%` }} /></span>
    </Link>
  );
}
