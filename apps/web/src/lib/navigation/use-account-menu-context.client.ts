"use client";

import { useEffect, useState } from "react";
import type { AccountMenuContext } from "./account-menu-context";

const cache = new Map<string, Promise<AccountMenuContext | null>>();

function fetchContext(): Promise<AccountMenuContext | null> {
  return fetch("/api/me/menu-context", { credentials: "same-origin" })
    .then((res) => (res.ok ? (res.json() as Promise<AccountMenuContext>) : null))
    .catch(() => null);
}

/**
 * Loads the account menu facts once per person and keeps them for the tab's lifetime, so
 * opening the menu does not refetch. Returns null until loaded or if the request fails;
 * the menu then shows its safe defaults.
 */
export function useAccountMenuContext(userId: string, enabled: boolean): AccountMenuContext | null {
  const [context, setContext] = useState<AccountMenuContext | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let pending = cache.get(userId);
    if (!pending) {
      pending = fetchContext();
      cache.set(userId, pending);
    }
    void pending.then((value) => {
      if (value === null) cache.delete(userId);
      if (!cancelled) setContext(value);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, enabled]);

  return context;
}
