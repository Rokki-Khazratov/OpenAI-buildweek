"use client";

import { BellRing, Check, KeyRound, Moon, Sun } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { PageFrame } from "@/components/layout/page-frame";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { applyTheme, THEME_STORAGE_KEY, type ThemePreference } from "@/lib/theme";

const themeOptions: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export default function SettingsPage() {
  const [theme, setTheme] = useState<ThemePreference>("light");
  const [notifications, setNotifications] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === "light" || stored === "dark") setTheme(stored);
      } catch {
      // Keep the light default when storage is unavailable.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function chooseTheme(value: ThemePreference) {
    setTheme(value);
    applyTheme(value);
  }

  function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  return (
    <PageFrame eyebrow="Account" title="Settings">
      <div className="grid max-w-[880px] gap-5">
        <section className="rounded-[14px] border border-line bg-white p-5 sm:p-7">
          <h2 className="text-sm font-semibold">Language and appearance</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <Field label="Language"><Select defaultValue="en"><option value="en">English</option><option value="de">Deutsch</option><option value="ru">Русский</option></Select></Field>
            <fieldset><legend className="text-sm font-medium">Theme</legend><div className="mt-2 grid grid-cols-2 gap-2">{themeOptions.map((option) => { const Icon = option.icon; const active = theme === option.value; return <button type="button" key={option.value} onClick={() => chooseTheme(option.value)} aria-pressed={active} className={`flex min-h-11 items-center justify-center gap-2 rounded-[9px] border text-sm font-medium transition ${active ? "border-signal bg-signal-soft text-signal" : "border-line bg-canvas text-muted hover:bg-surface"}`}><Icon size={15} /> {option.label}</button>; })}</div></fieldset>
          </div>
        </section>

        <section className="rounded-[14px] border border-line bg-white p-5 sm:p-7">
          <div className="flex items-start gap-4"><span className="grid size-10 place-items-center rounded-[10px] bg-surface text-muted"><BellRing size={18} /></span><div className="flex-1"><h2 className="text-sm font-semibold">Notifications</h2><p className="mt-1 text-xs leading-5 text-muted">Generation finished, class invitations and exam reminders.</p></div><button type="button" role="switch" aria-checked={notifications} onClick={() => setNotifications((current) => !current)} className={`relative h-6 w-11 rounded-full transition ${notifications ? "bg-signal" : "bg-[#b7b7bd]"}`}><span className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition ${notifications ? "left-[22px]" : "left-0.5"}`} /></button></div>
        </section>

        <form onSubmit={updatePassword} className="rounded-[14px] border border-line bg-white p-5 sm:p-7">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-[10px] bg-surface text-muted"><KeyRound size={18} /></span><div><h2 className="text-sm font-semibold">Password</h2><p className="mt-1 text-xs text-muted">Use at least 8 characters.</p></div></div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2"><Field label="Current password"><Input type="password" autoComplete="current-password" required /></Field><div /><Field label="New password"><Input type="password" autoComplete="new-password" minLength={8} required /></Field><Field label="Confirm new password"><Input type="password" autoComplete="new-password" minLength={8} required /></Field></div>
          <Button type="submit" className="mt-6">{saved ? <><Check size={16} /> Updated</> : "Update password"}</Button>
        </form>
      </div>
    </PageFrame>
  );
}
