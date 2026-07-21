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
  member_count: 4,
  active_learners: 3,
  total_attempts: 7,
  average_percentage: 68,
  readiness_percentage: 72,
  readiness_coverage: 0.75,
  pass_rate: 71,
  weak_skills: [
    { skill_id: "angular-momentum", percentage: 46, support: 5 },
    { skill_id: "perturbation-theory", percentage: 58, support: 4 },
    { skill_id: "wave-mechanics", percentage: 78, support: 7 },
  ],
  participants: [
    { user_id: "you", display_name: "You", role: "owner", attempts: 3, average_percentage: 74, readiness_percentage: 81, last_activity_at: "2026-07-20T07:42:00Z", weak_skill_ids: ["perturbation-theory"] },
    { user_id: "lin", display_name: "Lin M.", role: "member", attempts: 2, average_percentage: 67, readiness_percentage: 72, last_activity_at: "2026-07-20T06:10:00Z", weak_skill_ids: ["angular-momentum"] },
    { user_id: "noah", display_name: "Noah K.", role: "member", attempts: 2, average_percentage: 63, readiness_percentage: 63, last_activity_at: "2026-07-19T21:20:00Z", weak_skill_ids: ["angular-momentum", "perturbation-theory"] },
    { user_id: "mia", display_name: "Mia R.", role: "member", attempts: 0, average_percentage: null, readiness_percentage: null, last_activity_at: null, weak_skill_ids: [] },
  ],
};

const demoMembers: ClassMemberDto[] = demoDashboard.participants.map((item) => ({
  user_id: item.user_id,
  display_name: item.display_name,
  role: item.role,
  leaderboard_opt_in: false,
  joined_at: "2026-07-18T10:00:00Z",
}));

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
    { label: "Average", value: value(dashboard.average_percentage), icon: BarChart3 },
    { label: "Readiness", value: value(dashboard.readiness_percentage), icon: Target },
    { label: "Pass rate", value: value(dashboard.pass_rate), icon: CheckCircle2 },
  ];

  return <div className="mt-6 grid gap-5">
    <div className="flex flex-col gap-3 rounded-[13px] border border-line bg-surface-raised p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">Cohort signal</p><p className="mt-1 text-xs text-muted">Aggregates only. Raw responses and feedback stay private.</p></div><select aria-label="Filter dashboard by exam" value={examId} onChange={(event) => changeExam(event.target.value)} className="min-h-10 rounded-[9px] border border-line bg-white px-3 text-sm"><option value="">All scoped exams</option>{scopedExams.map((exam) => <option key={exam.id} value={exam.id}>{exam.title}</option>)}</select></div>
    {error && <p role="alert" className="rounded-[10px] border border-danger/30 bg-red-50 p-4 text-sm text-danger">{error}</p>}
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">{metrics.map((metric) => { const Icon = metric.icon; return <div key={metric.label} className="rounded-[13px] border border-line bg-white p-4"><div className="flex items-center justify-between"><p className="text-[11px] text-muted">{metric.label}</p><Icon size={15} className="text-muted" /></div><p className="mt-3 font-mono text-2xl font-semibold">{metric.value}</p></div>; })}</section>
    <div className="rounded-[12px] border border-line p-4"><div className="flex items-center justify-between text-xs"><span className="font-semibold">Readiness coverage</span><span className="font-mono text-muted">{dashboard.active_learners}/{dashboard.member_count} active</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-signal" style={{ width: `${dashboard.readiness_coverage * 100}%` }} /></div><p className="mt-2 text-[11px] text-muted">Readiness is the mean of each active participant’s latest evaluated attempt.</p></div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.8fr)]">
      <section className="overflow-hidden rounded-[14px] border border-line bg-white"><div className="border-b border-line bg-surface-raised p-5"><h2 className="text-sm font-semibold">Participant readiness</h2><p className="mt-1 text-xs text-muted">Privacy-safe operating view for the class owner.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-line text-[11px] text-muted"><tr><th className="px-5 py-3 font-medium">Participant</th><th className="px-4 py-3 font-medium">Attempts</th><th className="px-4 py-3 font-medium">Average</th><th className="px-4 py-3 font-medium">Readiness</th><th className="px-5 py-3 font-medium">Weak focus</th></tr></thead><tbody className="divide-y divide-line">{dashboard.participants.map((item) => <tr key={item.user_id}><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-full bg-surface text-xs font-semibold">{item.display_name.slice(0, 2).toUpperCase()}</span><div><p className="font-medium">{item.display_name}</p><p className="mt-0.5 text-[11px] capitalize text-muted">{item.role}</p></div></div></td><td className="px-4 py-4 font-mono">{item.attempts}</td><td className="px-4 py-4 font-mono">{value(item.average_percentage)}</td><td className="px-4 py-4"><StatusPill tone={item.readiness_percentage !== null && item.readiness_percentage >= 70 ? "success" : item.readiness_percentage === null ? "neutral" : "warning"}>{value(item.readiness_percentage)}</StatusPill></td><td className="px-5 py-4 text-xs text-muted">{item.weak_skill_ids.length ? item.weak_skill_ids.join(", ").replaceAll("-", " ") : "No signal yet"}</td></tr>)}</tbody></table></div></section>
      <section className="rounded-[14px] border border-line bg-white p-5"><h2 className="text-sm font-semibold">Skill health</h2><p className="mt-1 text-xs text-muted">Lowest evaluated skills first; support is graded questions.</p><div className="mt-5 grid gap-5">{dashboard.weak_skills.length ? dashboard.weak_skills.slice(0, 6).map((skill) => <div key={skill.skill_id}><div className="flex items-end justify-between gap-3"><p className="text-xs font-medium capitalize">{skill.skill_id.replaceAll("-", " ")}</p><p className="font-mono text-xs">{Math.round(skill.percentage)}%</p></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface"><div className={`h-full rounded-full ${skill.percentage < 60 ? "bg-warning" : "bg-signal"}`} style={{ width: `${skill.percentage}%` }} /></div><p className="mt-1.5 text-[10px] text-muted">{skill.support} graded question{skill.support === 1 ? "" : "s"}</p></div>) : <p className="rounded-[9px] bg-surface p-4 text-xs leading-5 text-muted">Skill analytics appear after the first evaluated attempt.</p>}</div></section>
    </div>
    <section className="rounded-[14px] border border-line bg-white"><div className="grid gap-5 border-b border-line bg-surface-raised p-5 lg:grid-cols-[1fr_auto] lg:items-end"><div><h2 className="text-sm font-semibold">Class membership</h2><p className="mt-1 text-xs text-muted">Add an existing ExamTwin account. No email invitation is sent.</p></div><form onSubmit={add} className="flex flex-col gap-2 sm:flex-row"><input name="email" type="email" required placeholder="student@example.com" className="min-h-10 min-w-[240px] rounded-[9px] border border-line bg-white px-3 text-sm outline-hidden focus:border-signal" /><Button type="submit" disabled={pending === "add"}><Plus size={15} /> {pending === "add" ? "Adding…" : "Add participant"}</Button></form></div><div className="divide-y divide-line">{members.map((member) => <div key={member.user_id} className="flex items-center gap-3 px-5 py-3.5"><span className="grid size-9 place-items-center rounded-full bg-surface text-muted"><UserRound size={15} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{member.display_name}</p><p className="text-[11px] capitalize text-muted">{member.role}</p></div>{member.role === "owner" ? <StatusPill tone="neutral">Owner</StatusPill> : <button aria-label={`Remove ${member.display_name}`} onClick={() => void remove(member.user_id)} disabled={pending === member.user_id} className="rounded-md p-2 text-muted hover:bg-red-50 hover:text-danger disabled:opacity-50">{pending === member.user_id ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}</button>}</div>)}</div></section>
  </div>;
}
