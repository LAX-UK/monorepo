"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_INTERVAL_MS = 8000;
/** Stop polling after onboarding exit once this window elapses. */
const DEFAULT_TIMEOUT_MS = 2 * 60 * 1000;

type Options = {
  enabled: boolean;
  onPoll: () => void | Promise<void>;
  intervalMs?: number;
  timeoutMs?: number;
};

/** Poll Connect sync while Stripe verification may still be in flight after onboarding exit. */
export function useConnectStatusPolling({
  enabled,
  onPoll,
  intervalMs = DEFAULT_INTERVAL_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: Options): { timedOut: boolean } {
  const onPollRef = useRef(onPoll);
  onPollRef.current = onPoll;
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setTimedOut(false);
      return;
    }

    setTimedOut(false);
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      if (document.hidden) return;
      if (Date.now() - startedAt > timeoutMs) {
        window.clearInterval(id);
        setTimedOut(true);
        return;
      }
      void onPollRef.current();
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [enabled, intervalMs, timeoutMs]);

  return { timedOut };
}
