"use client";

import { useEffect, useState } from "react";

/** Monotonic wall clock for client-only countdowns.
 * Returns `null` on the first render (SSR-safe); then `Date.now()` on a fixed interval while the tab is visible.
 */
export function useNow(intervalMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      setNow(Date.now());
    };

    const start = () => {
      if (id != null) return;
      tick();
      id = setInterval(tick, intervalMs);
    };

    const stop = () => {
      if (id != null) {
        clearInterval(id);
        id = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        tick();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") {
      start();
    } else {
      tick();
    }

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);

  return now;
}
