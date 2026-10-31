"use client";

import {
  type AccountNeedsYouCounts,
  type AccountNeedsYouPort,
  readAccountNeedsYou,
} from "@/lib/workspace/account-needs-you.client";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type AccountNeedsYouValue = {
  /** Counts by account id once read; `null` before the first read or when it failed. */
  counts: AccountNeedsYouCounts | null;
  /** Reads the counts unless a fresh answer is already held; call when the switcher opens. */
  request: () => void;
};

const AccountNeedsYouContext = createContext<AccountNeedsYouValue>({
  counts: null,
  request: () => {},
});

/** How long an answer is shown before opening the switcher reads it again. */
const FRESH_FOR_MS = 60_000;

/**
 * Holds the switcher's needs-you dots. Nothing is read until the switcher is about to open, so
 * a page load never pays for every account's Needs you; reopening within a minute reuses the
 * answer.
 */
export function AccountNeedsYouProvider({
  enabled,
  read = readAccountNeedsYou,
  now = Date.now,
  children,
}: {
  /** Off when there is nothing to switch to, or while support views the account. */
  enabled: boolean;
  read?: AccountNeedsYouPort;
  now?: () => number;
  children: ReactNode;
}) {
  const [counts, setCounts] = useState<AccountNeedsYouCounts | null>(null);
  const readAt = useRef(Number.NEGATIVE_INFINITY);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => () => inFlight.current?.abort(), []);

  const request = useCallback(() => {
    if (!enabled || inFlight.current || now() - readAt.current < FRESH_FOR_MS) return;
    const controller = new AbortController();
    inFlight.current = controller;
    read(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setCounts(result);
        if (result) readAt.current = now();
      })
      .catch(() => {
        if (!controller.signal.aborted) setCounts(null);
      })
      .finally(() => {
        if (inFlight.current === controller) inFlight.current = null;
      });
  }, [enabled, read, now]);

  const value = useMemo(() => ({ counts, request }), [counts, request]);
  return (
    <AccountNeedsYouContext.Provider value={value}>{children}</AccountNeedsYouContext.Provider>
  );
}

/** The switcher's dots and the way to ask for them. */
export function useAccountNeedsYou(): AccountNeedsYouValue {
  return useContext(AccountNeedsYouContext);
}
