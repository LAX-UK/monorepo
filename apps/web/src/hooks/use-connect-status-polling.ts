"use client";

import { useEffect, useRef } from "react";

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
}: Options) {
  const onPollRef = useRef(onPoll);
  onPollRef.current = onPoll;

  useEffect(() => {
    if (!enabled) return;

    const startedAt = Date.now();
    const id = window.setInterval(() => {
      if (document.hidden) return;
      if (Date.now() - startedAt > timeoutMs) {
        window.clearInterval(id);
        return;
      }
      void onPollRef.current();
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [enabled, intervalMs, timeoutMs]);
}
