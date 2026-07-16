"use client";

import { ChevronDown, LogOut, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { useCurrentUser } from "@/features/auth/current-user-provider";

export function AccountMenu() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const displayName = user?.display_name ?? (loading ? "Loading…" : "Account");
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "ET";
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }
  return (
    <div className="relative">
      <button onClick={() => setOpen((current) => !current)} aria-expanded={open} className="flex min-h-10 items-center gap-2 rounded-[10px] px-1.5 transition hover:bg-surface sm:px-2.5">
        <span className="grid size-8 place-items-center rounded-full bg-contrast text-xs font-semibold text-contrast-ink">{initials}</span>
        <span className="hidden min-w-0 text-left md:block"><span className="block max-w-28 truncate text-xs font-semibold leading-4">{displayName}</span><span className="block max-w-28 truncate text-[10px] leading-3 text-muted">{user?.email ?? "ExamTwin"}</span></span>
        <ChevronDown size={14} className="hidden text-muted sm:block" />
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-label="Close account menu" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[46px] z-50 w-[220px] rounded-[12px] border border-line bg-canvas p-1.5 shadow-float">
            <div className="border-b border-line px-3 py-2.5"><p className="truncate text-sm font-semibold">{displayName}</p><p className="mt-0.5 truncate text-xs text-muted">{user?.email ?? "Profile unavailable"}</p></div>
            <Link href="/profile" onClick={() => setOpen(false)} className="mt-1 flex min-h-10 items-center gap-2.5 rounded-[8px] px-3 text-sm hover:bg-surface"><UserRound size={16} /> Profile</Link>
            <Link href="/settings" onClick={() => setOpen(false)} className="flex min-h-10 items-center gap-2.5 rounded-[8px] px-3 text-sm hover:bg-surface"><Settings size={16} /> Settings</Link>
            <button type="button" onClick={signOut} className="mt-1 flex min-h-10 w-full items-center gap-2.5 border-t border-line px-3 pt-1 text-sm text-muted hover:text-ink"><LogOut size={16} /> Sign out</button>
          </div>
        </>
      )}
    </div>
  );
}
