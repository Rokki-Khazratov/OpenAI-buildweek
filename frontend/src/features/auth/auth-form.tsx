"use client";

import { ArrowRight, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRegister = mode === "register";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/auth/${isRegister ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Authentication failed");
      const requested = new URLSearchParams(window.location.search).get("next");
      const destination = requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/subjects";
      window.location.replace(destination);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Authentication failed");
      setPending(false);
    }
  }

  return (
    <div className="page-enter">
      <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted">{isRegister ? "Create account" : "Welcome back"}</p>
      <h1 className="mt-3 text-[34px] font-semibold tracking-[-0.04em]">{isRegister ? "Start with your first subject." : "Continue your preparation."}</h1>
      <p className="mt-3 text-[15px] leading-6 text-muted">{isRegister ? "Your exam materials are private until you choose to share them." : "Sign in to your subjects, mocks and progress."}</p>

      <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
        {isRegister && <Field label="Name"><Input name="name" placeholder="Rokki Khazratov" autoComplete="name" required /></Field>}
        <Field label="Email"><Input name="email" type="email" placeholder="you@example.com" autoComplete="email" required /></Field>
        <Field label="Password" hint={isRegister ? "At least 8 characters" : undefined}>
          <div className="relative">
            <Input name="password" type={showPassword ? "text" : "password"} placeholder="••••••••••••" autoComplete={isRegister ? "new-password" : "current-password"} minLength={8} required className="pr-12" />
            <button type="button" className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-surface" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((current) => !current)}>
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </Field>
        {error && <p role="alert" className="rounded-[9px] border border-danger/30 bg-red-50 px-3.5 py-3 text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={pending} className="mt-1 min-h-11 w-full">
          {pending ? "Opening workspace…" : isRegister ? "Create account" : "Sign in"}
          {!pending && <ArrowRight size={16} />}
        </Button>
      </form>

      <p className="mt-7 text-center text-sm text-muted">
        {isRegister ? "Already have an account?" : "New to ExamTwin?"}{" "}
        <Link href={isRegister ? "/login" : "/register"} className="font-semibold text-ink hover:text-signal">{isRegister ? "Sign in" : "Create account"}</Link>
      </p>
      {isRegister && <p className="mt-5 text-center text-[11px] leading-5 text-muted">By creating an account, you agree to use only materials you are allowed to upload and share.</p>}
    </div>
  );
}
