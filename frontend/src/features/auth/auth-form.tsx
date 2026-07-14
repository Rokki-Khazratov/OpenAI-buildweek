"use client";

import { ArrowRight, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const isRegister = mode === "register";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    window.setTimeout(() => router.push("/home"), 420);
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
        {!isRegister && <div className="-mt-2 text-right"><button type="button" className="text-xs font-semibold text-signal">Forgot password?</button></div>}
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
