"use client";

import {
  Activity,
  BarChart3,
  CheckCircle2,
  LoaderCircle,
  Plus,
  Target,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import type { Exam } from "@/features/exams/types";

import {
  addClassMember,
  getClassDashboard,
  listClassMembers,
  removeClassMember,
  type ClassDashboardDto,
  type ClassMemberDto,
} from "./api";
import type { StudyClass } from "./types";

const demoDashboard: ClassDashboardDto = {
  class_id: "demo",
  exam_id: null,
  model_version: "analytics.v2",
  privacy_threshold: 3,
  suppressed: false,
  suppression_reason: null,
  member_count: 4,
  active_learners: 3,
  eligible_learners: 3,
  total_attempts: 7,
  median_readiness_index: 72,
  readiness_coverage: 0.75,
  readiness_confidence_distribution: { low_evidence: 1, developing: 2, established: 0 },
  low_evidence_percentage: 33.3,
  weak_skills: [
    { skill_id: "angular-momentum", label: "Angular momentum", mastery_percentage: 46, confidence: 0.62, support: 3, evidence_count: 8, signal: "confirmed_gap" },
    { skill_id: "perturbation-theory", label: "Perturbation theory", mastery_percentage: 58, confidence: 0.31, support: 3, evidence_count: 4, signal: "low_evidence" },
  ],
  recommended_action: "Review Angular momentum with the whole class.",
};

const demoMembers: ClassMemberDto[] = [
  { user_id: "you", display_name: "You", role: "owner", leaderboard_opt_in: false, joined_at: "2026-07-18T10:00:00Z" },
  { user_id: "lin", display_name: "Lin M.", role: "member", leaderboard_opt_in: false, joined_at: "2026-07-18T10:00:00Z" },
  { user_id: "noah", display_name: "Noah K.", role: "member", leaderboard_opt_in: false, joined_at: "2026-07-18T10:00:00Z" },
  { user_id: "mia", display_name: "Mia R.", role: "member", leaderboard_opt_in: false, joined_at: "2026-07-18T10:00:00Z" },
];

function value(number: number | null, suffix = "%") {
  return number === null ? "—" : `${Math.round(number)}${suffix}`;
}

export function ClassDashboard({
  studyClass,
  exams,
}: {
  studyClass: StudyClass;
  exams: Exam[];
}) {
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const scopedExams = exams.filter(
    (exam) => exam.subjectId === studyClass.subjectId &&
      (studyClass.examScope === "subject" || studyClass.examIds.includes(exam.id)),
  );
  const [examId, setExamId] = useState("");
  const [dashboard, setDashboard] = useState<ClassDashboardDto | null>(demoMode ? demoDashboard : null);
  const [members, setMembers] = useState<ClassMemberDto[]>(demoMode ? demoMembers : []);
  const [loading, setLoading] = useState(!demoMode);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (demoMode) return;
    let active = true;
    void Promise.all([
      getClassDashboard(studyClass.id, examId || undefined),
      listClassMembers(studyClass.id),
    ])
      .then(([metrics, participantItems]) => {
        if (active) {
          setDashboard(metrics);
          setMembers(participantItems);
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Class analytics are unavailable.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [demoMode, examId, studyClass.id]);

  function changeExam(nextExamId: string) {
    if (!demoMode) setLoading(true);
    setError(null);
    setExamId(nextExamId);
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = String(new FormData(form).get("email") || "").trim();
    if (!email) return;
    setPending("add");
    setError(null);
    try {
      if (demoMode) {
        const name = email.split("@")[0].replace(/[._-]/g, " ");
        setMembers((current) => [...current, { user_id: `demo-${Date.now()}`, display_name: name, role: "member", leaderboard_opt_in: false, joined_at: new Date().toISOString() }]);
      } else {
        const item = await addClassMember(studyClass.id, email);
        setMembers((current) => [...current, item]);
        setDashboard(await getClassDashboard(studyClass.id, examId || undefined));
      }
      form.reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The participant could not be added.");
    } finally {
      setPending(null);
    }
  }

  async function remove(userId: string) {
    setPending(userId);
    setError(null);
    try {
      if (!demoMode) await removeClassMember(studyClass.id, userId);
      setMembers((current) => current.filter((item) => item.user_id !== userId));
      if (!demoMode) setDashboard(await getClassDashboard(studyClass.id, examId || undefined));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The participant could not be removed.");
    } finally {
      setPending(null);
    }
  }

  if (loading || !dashboard) return <div className="mt-6 flex min-h-[260px] items-center justify-center rounded-[14px] border border-line text-sm text-muted"><LoaderCircle size={16} className="mr-2 animate-spin" /> Loading cohort analytics…</div>;

  const metrics = [
    { label: "Participants", value: String(dashboard.member_count), icon: UsersRound },
    { label: "Attempts", value: String(dashboard.total_attempts), icon: Activity },
    { label: "Eligible", value: String(dashboard.eligible_learners), icon: CheckCircle2 },
    { label: "Median readiness", value: value(dashboard.median_readiness_index), icon: Target },
    { label: "Low evidence", value: value(dashboard.low_evidence_percentage), icon: BarChart3 },
  ];

  return <div className="mt-6 grid gap-5">
    <div className="flex flex-col gap-3 rounded-[13px] border border-line bg-surface-raised p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">Cohort signal</p><p className="mt-1 text-xs text-muted">Aggregates only. Raw responses and feedback stay private.</p></div><select aria-label="Filter dashboard by exam" value={examId} onChange={(event) => changeExam(event.target.value)} className="min-h-10 rounded-[9px] border border-line bg-white px-3 text-sm"><option value="">All scoped exams</option>{scopedExams.map((exam) => <option key={exam.id} value={exam.id}>{exam.title}</option>)}</select></div>
    {error && <p role="alert" className="rounded-[10px] border border-danger/30 bg-red-50 p-4 text-sm text-danger">{error}</p>}
    {dashboard.suppressed && <div className="rounded-[12px] border border-warning/30 bg-amber-50 p-5"><p className="text-sm font-semibold">Cohort signal suppressed</p><p className="mt-1 text-xs leading-5 text-muted">{dashboard.suppression_reason} No cohort activity or readiness values are shown until the threshold is met.</p></div>}
    {!dashboard.suppressed && <><section className="grid grid-cols-2 gap-3 lg:grid-cols-5">{metrics.map((metric) => { const Icon = metric.icon; return <div key={metric.label} className="rounded-[13px] border border-line bg-white p-4"><div className="flex items-center justify-between"><p className="text-[11px] text-muted">{metric.label}</p><Icon size={15} className="text-muted" /></div><p className="mt-3 font-mono text-2xl font-semibold">{metric.value}</p></div>; })}</section><div className="rounded-[12px] border border-line p-4"><div className="flex items-center justify-between text-xs"><span className="font-semibold">Readiness coverage</span><span className="font-mono text-muted">{dashboard.active_learners}/{dashboard.member_count} active</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-signal" style={{ width: `${dashboard.readiness_coverage * 100}%` }} /></div><p className="mt-2 text-[11px] text-muted">Readiness is aggregated only after the privacy threshold is met.</p></div></>}
    {!dashboard.suppressed && <div className="grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"><section className="rounded-[14px] border border-line bg-white p-5"><h2 className="text-sm font-semibold">Evidence confidence</h2><p className="mt-1 text-xs text-muted">Aggregate learner counts; no student rows are exposed.</p><div className="mt-5 grid gap-3">{Object.entries(dashboard.readiness_confidence_distribution).map(([label, count]) => <div key={label} className="flex items-center justify-between rounded-[9px] bg-surface p-3 text-xs"><span className="capitalize">{label.replaceAll("_", " ")}</span><span className="font-mono font-semibold">{count}</span></div>)}</div>{dashboard.recommended_action && <div className="mt-5 rounded-[10px] border border-signal/20 bg-blue-50 p-4 text-xs leading-5"><strong>Recommended class action:</strong> {dashboard.recommended_action}</div>}</section><section className="rounded-[14px] border border-line bg-white p-5"><h2 className="text-sm font-semibold">Skill health</h2><p className="mt-1 text-xs text-muted">Only skills supported by at least {dashboard.privacy_threshold} learners are shown.</p><div className="mt-5 grid gap-5">{dashboard.weak_skills.length ? dashboard.weak_skills.slice(0, 6).map((skill) => <div key={skill.skill_id}><div className="flex items-end justify-between gap-3"><p className="text-xs font-medium">{skill.label}</p><p className="font-mono text-xs">{Math.round(skill.mastery_percentage)}%</p></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface"><div className={`h-full rounded-full ${skill.signal === "confirmed_gap" ? "bg-warning" : "bg-signal"}`} style={{ width: `${skill.mastery_percentage}%` }} /></div><p className="mt-1.5 text-[10px] text-muted">{skill.support} learners · {skill.evidence_count} observations · {skill.signal.replaceAll("_", " ")}</p></div>) : <p className="rounded-[9px] bg-surface p-4 text-xs leading-5 text-muted">No skill meets the privacy and evidence thresholds yet.</p>}</div></section></div>}
    <section className="rounded-[14px] border border-line bg-white"><div className="grid gap-5 border-b border-line bg-surface-raised p-5 lg:grid-cols-[1fr_auto] lg:items-end"><div><h2 className="text-sm font-semibold">Class membership</h2><p className="mt-1 text-xs text-muted">Add an existing ExamTwin account. No email invitation is sent.</p></div><form onSubmit={add} className="flex flex-col gap-2 sm:flex-row"><input name="email" type="email" required placeholder="student@example.com" className="min-h-10 min-w-[240px] rounded-[9px] border border-line bg-white px-3 text-sm outline-hidden focus:border-signal" /><Button type="submit" disabled={pending === "add"}><Plus size={15} /> {pending === "add" ? "Adding…" : "Add participant"}</Button></form></div><div className="divide-y divide-line">{members.map((member) => <div key={member.user_id} className="flex items-center gap-3 px-5 py-3.5"><span className="grid size-9 place-items-center rounded-full bg-surface text-muted"><UserRound size={15} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{member.display_name}</p><p className="text-[11px] capitalize text-muted">{member.role}</p></div>{member.role === "owner" ? <StatusPill tone="neutral">Owner</StatusPill> : <button aria-label={`Remove ${member.display_name}`} onClick={() => void remove(member.user_id)} disabled={pending === member.user_id} className="rounded-md p-2 text-muted hover:bg-red-50 hover:text-danger disabled:opacity-50">{pending === member.user_id ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}</button>}</div>)}</div></section>
  </div>;
}
