import type { ReactNode } from "react";

type Tone = "neutral" | "signal" | "success" | "warning";

const tones: Record<Tone, string> = {
  neutral: "bg-surface text-muted",
  signal: "bg-signal-soft text-signal",
  success: "bg-emerald-50 text-success",
  warning: "bg-amber-50 text-warning",
};

export function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}
