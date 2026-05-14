"use client";

import { useEffect, useState } from "react";

/**
 * Returns a ticking `Date.now()` value on the client, and `null` during SSR /
 * the first client render. This avoids hydration mismatches in components that
 * format time-dependent text: render a stable placeholder while `nowMs` is
 * `null`, and start ticking after mount.
 *
 * @param intervalMs Tick interval in ms (default 1000).
 */
export function useClientClock(intervalMs = 1000): number | null {
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
    if (intervalMs <= 0) return;
    const id = window.setInterval(() => setNowMs(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return nowMs;
}
