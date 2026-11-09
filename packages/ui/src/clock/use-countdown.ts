"use client";

import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ClockStore } from "./clock-store.js";
import { defaultClockStore } from "./default-clock.js";

/** What a policy's answer must carry for the clock to know when to wake. */
export type TimedDisplay = { nextChangeInMs?: number };

/** A pure function from the surface and the time left to what to show. */
export type CountdownPolicy<S extends string, D extends TimedDisplay, C> = (
  surface: S,
  msLeft: number,
  ctx?: C,
) => D;

export type UseCountdownOptions<C> = {
  ctx?: C | undefined;
  /**
   * An element to watch: while it is off screen the countdown is unsubscribed (no timer for
   * it) and catches up when it comes back. Without it the countdown is always live.
   */
  inViewRef?: RefObject<Element | null> | undefined;
};

/** The answer without its wake time, so two answers that print the same compare equal. */
function stableKey(display: object): string {
  return JSON.stringify(display, (key, value) => (key === "nextChangeInMs" ? undefined : value));
}

/** Whether an element is on screen (always true where observers are not available). */
export function useInView(ref: RefObject<Element | null> | undefined): boolean {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const element = ref?.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      const latest = entries[entries.length - 1];
      if (latest) setInView(latest.isIntersecting);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return inView;
}

/**
 * Builds `useCountdown` for a policy. The policy lives with the domain; this package does not
 * import it, so Shop and lax.art can use the clock without the Bid domain.
 *
 * The hook returns `null` on the server and for the first client render (so hydration matches
 * whatever placeholder the caller prints), then the policy's answer. The component re-renders
 * only when the answer's text, tone or label changes.
 */
export function createCountdownHook<S extends string, D extends TimedDisplay, C = undefined>(
  policy: CountdownPolicy<S, D, C>,
  getStore: () => ClockStore = defaultClockStore,
) {
  return function useCountdown(
    targetMs: number,
    surface: S,
    options: UseCountdownOptions<C> = {},
  ): D | null {
    const { ctx, inViewRef } = options;
    const inView = useInView(inViewRef);
    const cache = useRef<{ key: string; value: D } | null>(null);

    const read = useCallback((): D => {
      const next = policy(surface, targetMs - getStore().now(), ctx);
      const key = stableKey(next);
      if (cache.current && cache.current.key === key) return cache.current.value;
      cache.current = { key, value: next };
      return next;
    }, [surface, targetMs, ctx, policy, getStore]);

    const subscribe = useCallback(
      (onChange: () => void) => {
        if (!inView || !Number.isFinite(targetMs)) return () => undefined;
        return getStore().subscribe({
          nextChangeAt(now) {
            const next = policy(surface, targetMs - now, ctx);
            return typeof next.nextChangeInMs === "number" ? now + next.nextChangeInMs : null;
          },
          notify: onChange,
        });
      },
      [inView, surface, targetMs, ctx, policy, getStore],
    );

    return useSyncExternalStore(subscribe, read, () => null);
  };
}

/**
 * The server-aligned time, rounded down to `resolutionMs`, for callers that decide something
 * from the time itself (a lot opening) rather than print a countdown. `null` on the server
 * and for the first client render. Re-renders once per step.
 */
export function useClockNow(
  resolutionMs = 1000,
  getStore: () => ClockStore = defaultClockStore,
): number | null {
  const subscribe = useCallback(
    (onChange: () => void) =>
      getStore().subscribe({
        nextChangeAt: (now) => (Math.floor(now / resolutionMs) + 1) * resolutionMs,
        notify: onChange,
      }),
    [resolutionMs, getStore],
  );
  const read = useCallback(
    () => Math.floor(getStore().now() / resolutionMs) * resolutionMs,
    [resolutionMs, getStore],
  );
  return useSyncExternalStore(subscribe, read, () => null);
}
