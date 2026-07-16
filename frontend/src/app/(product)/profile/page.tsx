"use client";

import { Check, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";

import { PageFrame } from "@/components/layout/page-frame";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useCurrentUser } from "@/features/auth/current-user-provider";

export default function ProfilePage() {
  const { user, loading, error: loadError, updateDisplayName } = useCurrentUser();

  return (
    <PageFrame eyebrow="Account" title="Profile">
      {loading ? <div className="max-w-[760px] rounded-[14px] border border-line bg-white p-7 text-sm text-muted">Loading your profile…</div> : user ? (
        <ProfileForm key={user.updated_at} user={user} loadError={loadError} updateDisplayName={updateDisplayName} />
      ) : <div role="alert" className="max-w-[760px] rounded-[14px] border border-danger/30 bg-red-50 p-5 text-sm text-danger">{loadError ?? "Your profile is unavailable."}</div>}
    </PageFrame>
  );
}

function ProfileForm({ user, loadError, updateDisplayName }: {
  user: NonNullable<ReturnType<typeof useCurrentUser>["user"]>;
  loadError: string | null;
  updateDisplayName: ReturnType<typeof useCurrentUser>["updateDisplayName"];
}) {
  const [displayName, setDisplayName] = useState(user.display_name);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await updateDisplayName(displayName.trim());
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="max-w-[760px] rounded-[14px] border border-line bg-white p-5 sm:p-7">
        <div className="mb-7 flex items-center gap-4 border-b border-line pb-7">
          <span className="grid size-20 place-items-center rounded-full bg-contrast text-xl font-semibold text-contrast-ink"><UserRound size={28} /></span>
          <div><p className="font-semibold">Personal account</p><p className="mt-1 text-sm text-muted">Your email is managed by your ExamTwin login.</p></div>
        </div>
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Display name"><Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={1} maxLength={120} required /></Field>
              <Field label="Email"><Input type="email" value={user.email} disabled className="bg-surface text-muted" /></Field>
            </div>
            {(error || loadError) && <p role="alert" className="mt-5 rounded-[9px] border border-danger/30 bg-red-50 px-3.5 py-3 text-sm text-danger">{error ?? loadError}</p>}
            <div className="mt-7 flex items-center gap-3"><Button type="submit" disabled={saving || !displayName.trim()}>{saved ? <><Check size={16} /> Saved</> : saving ? "Saving…" : "Save changes"}</Button><span className="text-xs text-muted">Avatar and password controls arrive after P0.</span></div>
          </>
      </form>
  );
}
