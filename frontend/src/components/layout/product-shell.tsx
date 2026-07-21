"use client";

import { Menu, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Brand } from "@/components/layout/brand";
import { AccountMenu } from "@/components/layout/account-menu";
import { GlobalSearch } from "@/components/layout/global-search";
import { mobileNavigation, navigation } from "@/data/navigation";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ProductShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] border-r border-line bg-surface-raised px-3 py-4 lg:flex lg:flex-col">
        <div className="px-2 pb-7 pt-0.5">
          <Brand />
        </div>

        <Link
          href="/exams/new"
          className="mb-5 flex min-h-10 items-center justify-between rounded-[9px] bg-contrast px-3.5 text-sm font-semibold text-contrast-ink transition hover:opacity-90"
        >
          New exam
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
                  active ? "bg-signal-soft font-semibold text-signal" : "text-muted hover:bg-surface hover:text-ink"
                }`}
              >
                <Icon size={18} strokeWidth={1.75} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

      </aside>

      <header className="fixed inset-x-0 top-0 z-20 flex h-16 items-center border-b border-line bg-canvas/92 px-4 backdrop-blur-xl lg:left-[232px] lg:px-7">
        <div className="lg:hidden">
          <Brand />
        </div>
        <button
          className="ml-3 grid size-10 place-items-center rounded-[9px] text-muted hover:bg-surface lg:hidden"
          aria-label="Open navigation"
          onClick={() => setMobileOpen(true)}
        >
          <Menu size={20} />
        </button>
        <GlobalSearch />
        <div className="ml-auto"><AccountMenu /></div>
      </header>

      <main className="min-h-dvh pb-24 pt-16 lg:ml-[232px] lg:pb-0">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid h-[72px] grid-cols-4 border-t border-line bg-canvas/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden" aria-label="Mobile navigation">
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
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px] lg:hidden" onClick={() => setMobileOpen(false)}>
          <aside className="h-full w-[86%] max-w-[320px] bg-canvas p-4 shadow-float" onClick={(event) => event.stopPropagation()}>
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
