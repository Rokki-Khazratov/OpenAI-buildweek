"use client";

import { Camera, Check, RotateCcw } from "lucide-react";
import { useState, type FormEvent } from "react";

import { PageFrame } from "@/components/layout/page-frame";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useDemo } from "@/features/demo/demo-provider";

export default function ProfilePage() {
  const { resetDemo } = useDemo();
  const [saved, setSaved] = useState(false);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <PageFrame eyebrow="Account" title="Profile" description="Manage the identity shown in your subjects, classes and community library.">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,680px)_280px]">
        <form onSubmit={save} className="rounded-[14px] border border-line bg-white p-5 sm:p-7">
          <div className="mb-7 flex items-center gap-4 border-b border-line pb-7">
            <span className="relative grid size-20 place-items-center rounded-full bg-ink text-xl font-semibold text-white">RK<button type="button" className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full border-2 border-white bg-signal text-white" aria-label="Change avatar"><Camera size={14} /></button></span>
            <div><p className="font-semibold">Profile photo</p><p className="mt-1 text-sm text-muted">JPG or PNG, up to 4 MB</p></div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Display name"><Input defaultValue="Rokki Khazratov" required /></Field>
            <Field label="Email"><Input type="email" defaultValue="rokki@example.com" disabled className="bg-surface text-muted" /></Field>
            <Field label="University"><Input defaultValue="TU Wien" /></Field>
            <Field label="Preferred language"><Input defaultValue="English" /></Field>
          </div>
          <div className="mt-7 flex items-center gap-3">
            <Button type="submit">{saved ? <><Check size={16} /> Saved</> : "Save changes"}</Button>
            <span className="text-xs text-muted">Email changes require verification.</span>
          </div>
        </form>
        <aside className="h-fit rounded-[14px] border border-line bg-surface-raised p-5">
          <p className="text-sm font-semibold">Visual demo</p>
          <p className="mt-2 text-xs leading-5 text-muted">Reset locally created subjects and restore the review dataset.</p>
          <Button variant="secondary" className="mt-5 w-full" onClick={resetDemo}><RotateCcw size={15} /> Reset demo data</Button>
        </aside>
      </div>
    </PageFrame>
  );
}
