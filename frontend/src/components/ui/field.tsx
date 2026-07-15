import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function Field({ label, hint, error, children }: FieldProps) {
  return (
    <label className="grid gap-2 text-sm font-medium text-ink">
      <span>{label}</span>
      {children}
      {error ? (
        <span className="text-xs font-normal text-danger" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="text-xs font-normal leading-5 text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`min-h-11 w-full rounded-[9px] border border-line bg-white px-3.5 text-[15px] text-ink shadow-[0_1px_1px_rgba(13,13,13,0.02)] transition placeholder:text-[#a1a1a7] hover:border-[#ceced3] focus:border-signal focus:outline-hidden ${className}`}
      {...props}
    />
  );
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`min-h-11 w-full rounded-[9px] border border-line bg-white px-3.5 text-[15px] text-ink transition hover:border-[#ceced3] focus:border-signal focus:outline-hidden ${className}`}
      {...props}
    />
  );
}
