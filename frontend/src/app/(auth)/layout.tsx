import type { ReactNode } from "react";

import { Brand } from "@/components/layout/brand";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh bg-white lg:grid-cols-[minmax(0,1fr)_minmax(480px,0.82fr)]">
      <section className="relative hidden overflow-hidden bg-ink p-10 text-white lg:flex lg:flex-col">
        <Brand />
        <div className="my-auto max-w-[580px]">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.14em] text-white/48">Exam fidelity, not generic practice</p>
          <h1 className="text-[52px] font-semibold leading-[1.02] tracking-[-0.055em]">Practice the exam you will actually take.</h1>
          <p className="mt-6 max-w-lg text-[16px] leading-7 text-white/60">Build a digital twin from past papers, rules, rubrics and notes. Then improve through realistic mock exams.</p>
        </div>
        <div className="grid grid-cols-3 border-t border-white/12 pt-6 text-xs">
          <div><span className="block font-mono text-lg text-white">01</span><span className="mt-1 block text-white/48">Reconstruct</span></div>
          <div><span className="block font-mono text-lg text-white">02</span><span className="mt-1 block text-white/48">Simulate</span></div>
          <div><span className="block font-mono text-lg text-white">03</span><span className="mt-1 block text-white/48">Adapt</span></div>
        </div>
        <div className="absolute right-[-80px] top-[18%] h-[340px] w-[340px] rounded-full border border-white/10" />
        <div className="absolute right-[40px] top-[29%] h-[110px] w-[110px] rounded-full border border-signal bg-signal/15" />
      </section>
      <section className="flex min-h-dvh flex-col p-5 sm:p-8 lg:p-10">
        <div className="lg:hidden"><Brand /></div>
        <div className="m-auto w-full max-w-[420px] py-10">{children}</div>
        <p className="text-center text-xs text-muted">Private by default · Your materials remain yours</p>
      </section>
    </main>
  );
}
