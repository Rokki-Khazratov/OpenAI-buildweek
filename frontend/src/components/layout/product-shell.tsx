"use client";

import { Bell, ChevronDown, Command, Menu, Plus, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Brand } from "@/components/layout/brand";
import { mobileNavigation, navigation } from "@/data/navigation";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ProductShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] border-r border-line bg-[#fbfbfc] px-3 py-4 lg:flex lg:flex-col">
        <div className="px-2 pb-7 pt-0.5">
          <Brand />
        </div>

        <Link
          href="/subjects/new"
          className="mb-5 flex min-h-10 items-center justify-between rounded-[9px] bg-ink px-3.5 text-sm font-semibold text-white transition hover:bg-[#242424]"
        >
          New subject
          <Plus size={17} strokeWidth={1.8} />
        </Link>

        <nav className="grid gap-1" aria-label="Main navigation">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`group flex min-h-10 items-center gap-3 rounded-[9px] px-3 text-sm transition ${
                  active ? "bg-signal-soft font-semibold text-signal" : "text-[#4f4f55] hover:bg-[#f0f0f2] hover:text-ink"
                }`}
              >
                <Icon size={18} strokeWidth={1.75} />
                <span>{item.label}</span>
                {item.soon && (
                  <span className="ml-auto rounded-full border border-line bg-white px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted">
                    Soon
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-line pt-3">
          <Link href="/profile" className="flex items-center gap-3 rounded-[10px] p-2.5 hover:bg-[#f0f0f2]">
            <span className="grid size-9 place-items-center rounded-full bg-[#e8e8eb] text-sm font-semibold">RK</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">Rokki Khazratov</span>
              <span className="block truncate text-xs text-muted">Student account</span>
            </span>
            <ChevronDown size={15} className="text-muted" />
          </Link>
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-20 flex h-16 items-center border-b border-line bg-white/92 px-4 backdrop-blur-xl lg:left-[232px] lg:px-7">
        <div className="lg:hidden">
          <Brand compact />
        </div>
        <button
          className="ml-3 grid size-10 place-items-center rounded-[9px] text-muted hover:bg-surface lg:hidden"
          aria-label="Open navigation"
          onClick={() => setMobileOpen(true)}
        >
          <Menu size={20} />
        </button>
        <button className="ml-3 hidden min-h-9 w-full max-w-[360px] items-center gap-2.5 rounded-[9px] border border-line bg-surface px-3 text-left text-sm text-muted transition hover:border-[#d1d1d5] sm:flex lg:ml-0">
          <Search size={16} />
          <span className="flex-1">Search subjects, exams, classes</span>
          <span className="flex items-center gap-1 rounded border border-line bg-white px-1.5 py-0.5 font-mono text-[10px]">
            <Command size={10} />K
          </span>
        </button>
        <div className="ml-auto flex items-center gap-1.5">
          <button className="grid size-10 place-items-center rounded-[9px] text-muted hover:bg-surface" aria-label="Notifications">
            <Bell size={18} strokeWidth={1.75} />
          </button>
          <Link href="/profile" className="grid size-10 place-items-center rounded-[9px] text-muted hover:bg-surface lg:hidden" aria-label="Profile">
            <UserRound size={19} strokeWidth={1.75} />
          </Link>
        </div>
      </header>

      <main className="min-h-dvh pb-24 pt-16 lg:ml-[232px] lg:pb-0">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid h-[72px] grid-cols-4 border-t border-line bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden" aria-label="Mobile navigation">
        {mobileNavigation.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link key={item.href} href={item.href} className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${active ? "text-signal" : "text-muted"}`}>
              <Icon size={19} strokeWidth={active ? 2 : 1.7} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-ink/25 backdrop-blur-[2px] lg:hidden" onClick={() => setMobileOpen(false)}>
          <aside className="h-full w-[86%] max-w-[320px] bg-white p-4 shadow-float" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between pb-6">
              <Brand />
              <button className="rounded-lg px-3 py-2 text-sm text-muted" onClick={() => setMobileOpen(false)}>Close</button>
            </div>
            <nav className="grid gap-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className="flex min-h-11 items-center gap-3 rounded-[9px] px-3 text-sm hover:bg-surface">
                    <Icon size={18} /> {item.label}
                    {item.soon && <span className="ml-auto text-[10px] text-muted">Soon</span>}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}
