"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { AccountMenuContext } from "./account-menu-context";

/** How long loaded facts count as fresh. Counts change during a sale, so they are re-read. */
const FRESH_FOR_MS = 30_000;

type Entry = { loadedAt: number; pending: Promise<AccountMenuContext | null> };

const cache = new Map<string, Entry>();

function fetchContext(): Promise<AccountMenuContext | null> {
  return fetch("/api/me/menu-context", { credentials: "same-origin" })
    .then((res) => (res.ok ? (res.json() as Promise<AccountMenuContext>) : null))
    .catch(() => null);
}

function freshEntry(userId: string, now: number): Entry {
  const cached = cache.get(userId);
  if (cached && now - cached.loadedAt < FRESH_FOR_MS) return cached;
  const entry = { loadedAt: now, pending: fetchContext() };
  cache.set(userId, entry);
  return entry;
}

/**
 * Loads the account menu facts once per person and shares them between the header menu, the
 * chip and the account sub-navigation. They are re-read on navigation once older than 30
 * seconds. Returns the last known facts meanwhile, and null until the first load (or when it
 * fails); callers then show their safe defaults.
 */
export function useAccountMenuContext(userId: string, enabled: boolean): AccountMenuContext | null {
  const [context, setContext] = useState<AccountMenuContext | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    void pathname;
    if (!enabled) return;
    let cancelled = false;
    const entry = freshEntry(userId, Date.now());
    void entry.pending.then((value) => {
      if (value === null && cache.get(userId) === entry) cache.delete(userId);
      if (!cancelled && value !== null) setContext(value);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, enabled, pathname]);

  return context;
}
