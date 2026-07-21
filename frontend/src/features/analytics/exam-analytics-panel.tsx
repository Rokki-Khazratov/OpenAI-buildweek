import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  Minus,
  ScanSearch,
} from "lucide-react";
import Link from "next/link";

import { StatusPill } from "@/components/ui/status-pill";

import type { ExamAnalytics, SkillAnalytics } from "./types";

export function ExamAnalyticsPanel({ profile }: { profile: ExamAnalytics }) {
  const readiness = profile.readiness;
  const readinessValue = readiness.index ?? 0;
  return (
    <>
      <section className="mt-6 grid overflow-hidden rounded-[15px] border border-line lg:grid-cols-[300px_1fr]" aria-label="Readiness analysis">
        <div className="bg-contrast p-6 text-contrast-ink sm:p-7">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-55">readiness index</p>
            <StatusPill tone={readiness.status === "ready" || readiness.status === "on_track" ? "success" : readiness.status === "at_risk" ? "danger" : "warning"}>
              {readiness.status.replaceAll("_", " ")}
            </StatusPill>
          </div>
          <p className="mt-8 font-mono text-7xl font-semibold tracking-[-0.08em]">{readiness.index ?? "—"}</p>
          <div className="mt-7">
            <div className="relative h-1.5 rounded-full bg-white/15">
              <div className="h-full rounded-full bg-white" style={{ width: `${readinessValue}%` }} />
              <span className="absolute -top-1 h-3.5 w-px bg-white/60" style={{ left: `${readiness.pass_threshold}%` }} />
            </div>
            <div className="mt-2 flex justify-between font-mono text-[9px] opacity-55"><span>0</span><span>pass {readiness.pass_threshold}</span><span>100</span></div>
          </div>
        </div>
        <div className="grid content-between gap-8 bg-surface-raised p-6 sm:p-7">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={readiness.confidence >= 0.7 ? "success" : "warning"}>{Math.round(readiness.confidence * 100)}% confidence</StatusPill>
              <span className="font-mono text-[10px] text-muted">{Math.round(readiness.coverage * 100)}% blueprint coverage</span>
            </div>
            <h2 className="mt-4 text-xl font-semibold tracking-[-0.03em]">{readiness.explanation}</h2>
            <p className="mt-2 text-xs leading-5 text-muted">
              This is a preparation index, not a pass probability. It combines blueprint-weighted mastery with an explicit uncertainty penalty.
            </p>
          </div>
          {profile.adaptive.eligible ? (
            <div className="flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="flex items-center gap-2 text-sm font-semibold"><BrainCircuit size={15} className="text-signal" /> Adaptive mock is ready</p><p className="mt-1 text-xs text-muted">{profile.adaptive.reason}</p></div>
              <Link href={`/exams/${profile.exam_id}/run?mode=adaptive`} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-[9px] bg-signal px-4 text-sm font-semibold text-white">Run adaptive mock <ArrowRight size={14} /></Link>
            </div>
          ) : (
            <p className="border-t border-line pt-5 text-xs text-muted">{profile.adaptive.reason}</p>
          )}
        </div>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-[14px] border border-line p-5 sm:p-6" aria-labelledby="skill-evidence-title">
          <div className="flex items-center justify-between gap-3"><div><h2 id="skill-evidence-title" className="text-sm font-semibold">Skill evidence</h2><p className="mt-1 text-xs text-muted">Mastery and confidence remain separate.</p></div><ScanSearch size={17} className="text-signal" /></div>
          <div className="mt-5 grid gap-1">
            {profile.skills.map((skill) => <SkillRow key={skill.skill_id} skill={skill} targeted={profile.adaptive.target_skill_ids.includes(skill.skill_id)} />)}
          </div>
        </section>
        <section className="rounded-[14px] border border-line p-5 sm:p-6" aria-labelledby="recommendation-title">
          <h2 id="recommendation-title" className="text-sm font-semibold">Recommended sequence</h2>
          <p className="mt-1 text-xs text-muted">Ranked by impact, uncertainty, trend, and exam proximity.</p>
          <ol className="mt-5 grid gap-4">
            {profile.recommendations.map((item, index) => (
              <li key={`${item.action}-${index}`} className="grid grid-cols-[24px_1fr] gap-3 border-b border-line pb-4 last:border-0 last:pb-0">
                <span className="font-mono text-xs text-muted">{String(index + 1).padStart(2, "0")}</span>
                <div><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs leading-5 text-muted">{item.reason}</p></div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}

function SkillRow({ skill, targeted }: { skill: SkillAnalytics; targeted: boolean }) {
  const TrendIcon = skill.trend === "improving" ? ArrowUpRight : skill.trend === "declining" ? ArrowDownRight : Minus;
  return (
    <div className={`grid gap-3 rounded-[9px] px-3 py-3 sm:grid-cols-[minmax(140px,1fr)_1.2fr_88px_80px] sm:items-center ${targeted ? "bg-signal-soft" : "hover:bg-surface"}`}>
      <div className="min-w-0"><p className="truncate text-xs font-semibold">{skill.label}</p><p className="mt-0.5 font-mono text-[9px] text-muted">{Math.round(skill.blueprint_weight * 100)}% blueprint</p></div>
      <div><div className="flex justify-between font-mono text-[9px] text-muted"><span>mastery</span><span>{skill.mastery === null ? "—" : `${Math.round(skill.mastery * 100)}%`}</span></div><div className="mt-1.5 h-1.5 rounded-full bg-line"><div className="h-full rounded-full bg-signal" style={{ width: `${(skill.mastery ?? 0) * 100}%` }} /></div></div>
      <div><p className="font-mono text-xs font-semibold">{Math.round(skill.confidence * 100)}%</p><p className="text-[9px] text-muted">confidence</p></div>
      <div className="flex items-center gap-1 text-[10px] text-muted"><TrendIcon size={13} className={skill.trend === "improving" ? "text-success" : skill.trend === "declining" ? "text-danger" : ""} /> {skill.trend.replaceAll("_", " ")}</div>
    </div>
  );
}
