"use client";

import { Archive, Camera, Check, FileText, FolderArchive, UsersRound } from "lucide-react";
import { useState, type FormEvent } from "react";

import { PageFrame } from "@/components/layout/page-frame";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { StatusPill } from "@/components/ui/status-pill";

type ProfileTab = "personal" | "classes" | "archive";

const tabs: { id: ProfileTab; label: string }[] = [
  { id: "personal", label: "Personal" },
  { id: "classes", label: "Classes" },
  { id: "archive", label: "Archive" },
];

export default function ProfilePage() {
  const [tab, setTab] = useState<ProfileTab>("personal");
  const [saved, setSaved] = useState(false);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  return (
    <PageFrame eyebrow="RK / Account" title="Profile">
      <div className="mb-7 flex gap-1 overflow-x-auto border-b border-line" role="tablist" aria-label="Profile sections">
        {tabs.map((item) => <button key={item.id} role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`relative min-h-11 whitespace-nowrap px-4 text-sm font-medium transition ${tab === item.id ? "text-ink after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-signal" : "text-muted hover:text-ink"}`}>{item.label}</button>)}
      </div>

      {tab === "personal" && (
        <form onSubmit={save} className="max-w-[760px] rounded-[14px] border border-line bg-white p-5 sm:p-7">
          <div className="mb-7 flex items-center gap-4 border-b border-line pb-7">
            <span className="relative grid size-20 place-items-center rounded-full bg-contrast text-xl font-semibold text-contrast-ink">RK<button type="button" className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full border-2 border-canvas bg-signal text-white" aria-label="Change avatar"><Camera size={14} /></button></span>
            <div><p className="font-semibold">Profile photo</p><p className="mt-1 text-sm text-muted">JPG or PNG · 4 MB max</p></div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Display name"><Input defaultValue="Rokki Khazratov" required /></Field>
            <Field label="Username"><Input defaultValue="rokki" required /></Field>
            <Field label="Email"><Input type="email" defaultValue="rokki@example.com" disabled className="bg-surface text-muted" /></Field>
            <Field label="University"><Input defaultValue="TU Wien" /></Field>
          </div>
          <div className="mt-7 flex items-center gap-3"><Button type="submit">{saved ? <><Check size={16} /> Saved</> : "Save changes"}</Button><span className="text-xs text-muted">Email stays locked until verification is implemented.</span></div>
        </form>
      )}

      {tab === "classes" && (
        <div className="grid gap-4 md:grid-cols-2">
          {[{ name: "Quantum study group", subject: "Quantum Physics", members: 8, scope: "Entire subject" }, { name: "Algorithms final", subject: "Algorithms & Data Structures", members: 5, scope: "Final exam only" }].map((item) => <article key={item.name} className="rounded-[14px] border border-line bg-white p-5 sm:p-6"><div className="flex items-start justify-between"><span className="grid size-10 place-items-center rounded-[10px] bg-signal-soft text-signal"><UsersRound size={18} /></span><StatusPill tone="neutral">Member</StatusPill></div><h2 className="mt-6 text-lg font-semibold tracking-[-0.02em]">{item.name}</h2><p className="mt-1 text-sm text-muted">{item.subject}</p><div className="mt-6 flex justify-between border-t border-line pt-4 text-xs text-muted"><span>{item.members} members</span><span>{item.scope}</span></div></article>)}
        </div>
      )}

      {tab === "archive" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="overflow-hidden rounded-[14px] border border-line bg-white">
            <div className="flex items-center justify-between border-b border-line p-5"><div><h2 className="text-sm font-semibold">Archived files</h2><p className="mt-1 text-xs text-muted">Files removed from active Subjects stay here until permanent deletion.</p></div><Archive size={18} className="text-muted" /></div>
            <div className="divide-y divide-line">
              {[{ name: "Final_exam_2023.pdf", subject: "Quantum Physics", date: "10 Jul 2026", size: "2.4 MB" }, { name: "old_rubric.docx", subject: "Algorithms", date: "02 Jul 2026", size: "184 KB" }, { name: "lecture_notes_week_1.pdf", subject: "German C1", date: "21 Jun 2026", size: "6.8 MB" }].map((file) => <div key={file.name} className="flex items-center gap-3 p-4 sm:px-5"><span className="grid size-9 place-items-center rounded-[8px] bg-surface text-muted"><FileText size={16} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{file.name}</p><p className="mt-0.5 text-xs text-muted">{file.subject} · {file.date}</p></div><span className="hidden font-mono text-[11px] text-muted sm:block">{file.size}</span><button className="rounded-[7px] border border-line px-2.5 py-1.5 text-xs font-medium hover:bg-surface">Restore</button></div>)}
            </div>
          </section>
          <aside className="h-fit rounded-[14px] border border-line bg-surface-raised p-5"><FolderArchive size={19} className="text-muted" /><p className="mt-5 text-sm font-semibold">30-day recovery</p><p className="mt-2 text-xs leading-5 text-muted">Archived files preserve their Subject and Exam references. Permanent deletion will be available after storage APIs are connected.</p><p className="mt-5 font-mono text-2xl font-semibold">9.4 MB</p><p className="mt-1 text-xs text-muted">3 archived files</p></aside>
        </div>
      )}
    </PageFrame>
  );
}
