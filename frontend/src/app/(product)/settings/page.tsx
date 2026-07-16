"use client";

import { LockKeyhole, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { PageFrame } from "@/components/layout/page-frame";
import {
  applyTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme";

const themeOptions: {
  value: ThemePreference;
  label: string;
  icon: typeof Sun;
}[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export default function SettingsPage() {
  const [theme, setTheme] = useState<ThemePreference>("light");

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

  return (
    <PageFrame eyebrow="Account" title="Settings">
      <div className="grid max-w-[880px] gap-5">
        <section className="rounded-[14px] border border-line bg-white p-5 sm:p-7">
          <h2 className="text-sm font-semibold">Appearance</h2>
          <fieldset className="mt-6 max-w-md">
            <legend className="text-sm font-medium">Theme</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {themeOptions.map((option) => {
                const Icon = option.icon;
                const active = theme === option.value;
                return (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => chooseTheme(option.value)}
                    aria-pressed={active}
                    className={`flex min-h-11 items-center justify-center gap-2 rounded-[9px] border text-sm font-medium transition ${active ? "border-signal bg-signal-soft text-signal" : "border-line bg-canvas text-muted hover:bg-surface"}`}
                  >
                    <Icon size={15} /> {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </section>

        <section className="rounded-[14px] border border-line bg-white p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <span className="grid size-10 place-items-center rounded-[10px] bg-surface text-muted">
              <LockKeyhole size={18} />
            </span>
            <div>
              <h2 className="text-sm font-semibold">
                Account security and notifications
              </h2>
              <p className="mt-1 text-xs leading-5 text-muted">
                Password reset, notification preferences, and language settings
                are intentionally unavailable in P0. No placeholder controls are
                shown as completed features.
              </p>
            </div>
          </div>
        </section>
      </div>
    </PageFrame>
  );
}
