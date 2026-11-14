"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { AccountMenuContext } from "./account-menu-context";

/** How long loaded facts count as fresh. Counts change during a sale, so they are re-read. */
const FRESH_FOR_MS = 30_000;

type Entry = { loadedAt: number; pending: Promise<AccountMenuContext | null> };

const cache = new Map<string, Entry>();

/**
 * Waits before reading the facts again after a failed read (a 503 while the accounts cannot be
 * read, a dropped request). Without it a single failure left the phone account button, which
 * draws nothing until the facts arrive, missing until the next navigation.
 */
export const ACCOUNT_MENU_CONTEXT_RETRY_MS = [1_000, 2_000, 4_000, 8_000] as const;

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
 * seconds. A failed read is tried again a few times (see {@link ACCOUNT_MENU_CONTEXT_RETRY_MS}).
 * Returns the last known facts meanwhile, and null until the first load (or while it keeps
 * failing); callers then show their safe defaults.
 */
export function useAccountMenuContext(userId: string, enabled: boolean): AccountMenuContext | null {
  const [context, setContext] = useState<AccountMenuContext | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    void pathname;
    if (!enabled) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const load = (attempt: number) => {
      const entry = freshEntry(userId, Date.now());
      void entry.pending.then((value) => {
        if (value === null && cache.get(userId) === entry) cache.delete(userId);
        if (cancelled) return;
        if (value !== null) {
          setContext(value);
          return;
        }
        const delay = ACCOUNT_MENU_CONTEXT_RETRY_MS[attempt];
        if (delay !== undefined) retryTimer = setTimeout(() => load(attempt + 1), delay);
      });
    };
    load(0);
    return () => {
      cancelled = true;
      if (retryTimer !== undefined) clearTimeout(retryTimer);
    };
  }, [userId, enabled, pathname]);

  return context;
}
