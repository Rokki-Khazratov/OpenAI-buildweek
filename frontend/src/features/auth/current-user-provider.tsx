"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { getCurrentUser, updateCurrentUser, type CurrentUserDto } from "@/features/auth/api";

export type CurrentUser = CurrentUserDto;

type CurrentUserContextValue = {
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<CurrentUser>;
};

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

const demoUser: CurrentUser = {
  id: "demo-user",
  email: "demo@examtwin.local",
  display_name: "Demo Student",
  is_active: true,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const [user, setUser] = useState<CurrentUser | null>(demoMode ? demoUser : null);
  const [loading, setLoading] = useState(!demoMode);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (demoMode) return;
    setLoading(true);
    setError(null);
    try {
      setUser(await getCurrentUser());
    } catch (reason) {
      setUser(null);
      setError(reason instanceof Error ? reason.message : "Unable to load your profile.");
    } finally {
      setLoading(false);
    }
  }, [demoMode]);

  useEffect(() => {
    if (demoMode) return;
    let cancelled = false;
    void getCurrentUser()
      .then((next) => { if (!cancelled) setUser(next); })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setUser(null);
          setError(reason instanceof Error ? reason.message : "Unable to load your profile.");
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [demoMode]);

  const updateDisplayName = useCallback(async (displayName: string) => {
    if (demoMode) {
      const next = { ...demoUser, display_name: displayName };
      setUser(next);
      return next;
    }
    const next = await updateCurrentUser(displayName);
    setUser(next);
    return next;
  }, [demoMode]);

  const value = useMemo(() => ({ user, loading, error, refresh, updateDisplayName }), [user, loading, error, refresh, updateDisplayName]);
  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser() {
  const context = useContext(CurrentUserContext);
  if (!context) throw new Error("useCurrentUser must be used inside CurrentUserProvider");
  return context;
}
