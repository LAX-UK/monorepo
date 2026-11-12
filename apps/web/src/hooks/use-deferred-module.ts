"use client";

import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useCallback, useEffect, useState } from "react";

export type DeferredModuleState<T> =
  | { status: "idle" | "loading" | "failed"; value: null }
  | { status: "ready"; value: T };

/** How long a fetch may take before the part is reported as not loaded. */
export const DEFERRED_MODULE_TIMEOUT_MS = 10_000;

/**
 * Modules that have already arrived, by loader. A part mounted again after a client navigation is
 * drawn at once, as it was before it was split out, instead of showing its stand-in first.
 */
const resolvedModules = new WeakMap<() => Promise<unknown>, unknown>();

function cachedModule<T>(load: () => Promise<T>): { value: T } | null {
  return resolvedModules.has(load) ? { value: resolvedModules.get(load) as T } : null;
}

/**
 * Fetches a part of the page with a dynamic import once `enabled` is true. It is `loading` until
 * the module arrives, `failed` after a rejected import or `timeoutMs`, and `retry` starts again.
 * Once a module has arrived, later mounts are `ready` from their first render whether or not they
 * are enabled (nothing more is fetched), except while the server HTML is hydrating, where the
 * stand-in is drawn so the markup matches.
 * `load` must be a stable function (a module-level arrow), so the fetch is not restarted by a
 * render and the arrived module can be remembered.
 */
export function useDeferredModule<T>(
  load: () => Promise<T>,
  enabled: boolean,
  timeoutMs: number = DEFERRED_MODULE_TIMEOUT_MS,
): DeferredModuleState<T> & { retry: () => void } {
  const hydrated = useHydrated();
  const [state, setState] = useState<DeferredModuleState<T>>({ status: "idle", value: null });
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` restarts the fetch on retry
  useEffect(() => {
    const cached = cachedModule(load);
    if (cached) {
      setState({ status: "ready", value: cached.value });
      return;
    }
    if (!enabled) return;
    let cancelled = false;
    setState({ status: "loading", value: null });
    const timer = setTimeout(() => {
      if (!cancelled) setState({ status: "failed", value: null });
    }, timeoutMs);
    load().then(
      (value) => {
        clearTimeout(timer);
        resolvedModules.set(load, value);
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

  if (state.status !== "ready" && hydrated) {
    const cached = cachedModule(load);
    if (cached) return { status: "ready", value: cached.value, retry };
  }
  return { ...state, retry };
}
