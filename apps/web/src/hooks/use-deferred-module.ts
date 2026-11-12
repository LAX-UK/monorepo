"use client";

import { useCallback, useEffect, useState } from "react";

export type DeferredModuleState<T> =
  | { status: "idle" | "loading" | "failed"; value: null }
  | { status: "ready"; value: T };

/** How long a fetch may take before the part is reported as not loaded. */
export const DEFERRED_MODULE_TIMEOUT_MS = 10_000;

/**
 * Fetches a part of the page with a dynamic import once `enabled` is true. It is `loading` until
 * the module arrives, `failed` after a rejected import or `timeoutMs`, and `retry` starts again.
 * `load` must be a stable function (a module-level arrow), so the fetch is not restarted by a
 * render.
 */
export function useDeferredModule<T>(
  load: () => Promise<T>,
  enabled: boolean,
  timeoutMs: number = DEFERRED_MODULE_TIMEOUT_MS,
): DeferredModuleState<T> & { retry: () => void } {
  const [state, setState] = useState<DeferredModuleState<T>>({ status: "idle", value: null });
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` restarts the fetch on retry
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState({ status: "loading", value: null });
    const timer = setTimeout(() => {
      if (!cancelled) setState({ status: "failed", value: null });
    }, timeoutMs);
    load().then(
      (value) => {
        clearTimeout(timer);
        if (!cancelled) setState({ status: "ready", value });
      },
      () => {
        clearTimeout(timer);
        if (!cancelled) setState({ status: "failed", value: null });
      },
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, load, timeoutMs, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
