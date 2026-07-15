import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const styles: Record<ButtonVariant, string> = {
  primary:
    "bg-signal text-white border-signal hover:bg-[#2020e8] shadow-[0_8px_20px_rgba(46,46,255,0.18)]",
  secondary: "bg-white text-ink border-line hover:bg-surface",
  ghost: "bg-transparent text-ink border-transparent hover:bg-surface",
  danger: "bg-white text-danger border-line hover:border-danger/30 hover:bg-red-50",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
}) {
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] border px-4 text-sm font-semibold transition duration-200 ease-exam disabled:cursor-not-allowed disabled:opacity-45 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
