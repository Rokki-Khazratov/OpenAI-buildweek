"use client";

import { Menu, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

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
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setSidebarOpen(window.localStorage.getItem("examtwin.sidebar.open") !== "false");
      } catch {
        // Keep the sidebar open when browser storage is unavailable.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function toggleSidebar() {
    setSidebarOpen((current) => {
      const next = !current;
      try {
        window.localStorage.setItem("examtwin.sidebar.open", String(next));
      } catch {
        // The interaction still works for the current session.
      }
      return next;
    });
  }

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <aside className={`fixed inset-y-0 left-0 z-30 hidden border-r border-line bg-surface-raised px-3 py-4 transition-[width] duration-300 ease-exam lg:flex lg:flex-col ${sidebarOpen ? "w-[232px]" : "w-[72px]"}`}>
        <div className={`flex min-h-8 items-center pb-7 pt-0.5 ${sidebarOpen ? "justify-between px-2" : "justify-center"}`}>
          {sidebarOpen && <Brand />}
          <button
            type="button"
            onClick={toggleSidebar}
            className="grid size-8 shrink-0 place-items-center rounded-[8px] text-muted transition hover:bg-surface hover:text-ink"
            aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            aria-expanded={sidebarOpen}
            title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          >
            {sidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
          </button>
        </div>

        <Link
          href="/exams/new"
          className={`mb-5 flex min-h-10 items-center rounded-[9px] bg-contrast text-sm font-semibold text-contrast-ink transition hover:opacity-90 ${sidebarOpen ? "justify-between px-3.5" : "justify-center px-0"}`}
          aria-label="New exam"
          title={!sidebarOpen ? "New exam" : undefined}
        >
          {sidebarOpen && <span>New exam</span>}
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
                className={`group flex min-h-10 items-center rounded-[9px] text-sm transition ${sidebarOpen ? "gap-3 px-3" : "justify-center px-0"} ${
                  active ? "bg-signal-soft font-semibold text-signal" : "text-muted hover:bg-surface hover:text-ink"
                }`}
                title={!sidebarOpen ? item.label : undefined}
              >
                <Icon size={18} strokeWidth={1.75} />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

      </aside>

      <header className={`fixed inset-x-0 top-0 z-20 flex h-16 items-center border-b border-line bg-canvas/92 px-4 backdrop-blur-xl transition-[left] duration-300 ease-exam lg:px-7 ${sidebarOpen ? "lg:left-[232px]" : "lg:left-[72px]"}`}>
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

      <main className={`min-h-dvh pb-24 pt-16 transition-[margin] duration-300 ease-exam lg:pb-0 ${sidebarOpen ? "lg:ml-[232px]" : "lg:ml-[72px]"}`}>{children}</main>

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
