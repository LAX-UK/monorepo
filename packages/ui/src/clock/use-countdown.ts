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

/**
 * A policy's answer. When it carries `nextChangeInMs` the clock wakes the component then; an
 * answer without one (closed, no time) never changes by itself.
 */
export type TimedDisplay = object;

function nextChangeOf(display: TimedDisplay): number | null {
  const value = (display as { nextChangeInMs?: unknown }).nextChangeInMs;
  return typeof value === "number" ? value : null;
}

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
            const wait = nextChangeOf(policy(surface, targetMs - now, ctx));
            return wait === null ? null : now + wait;
          },
          notify: onChange,
        });
      },
      [inView, surface, targetMs, ctx, policy, getStore],
    );

    return useSyncExternalStore(subscribe, read, () => null);
  };
}

export type UseClockTickOptions = {
  /** Resubscribe when what `wake` depends on changes (for example a lot's end time). */
  key: string | number;
  inViewRef?: RefObject<Element | null> | undefined;
};

/**
 * The server-aligned time as of the last moment the caller asked to be woken, for components that
 * work out their own text from the time. `wake` says how many milliseconds until that text next
 * changes (`null` when it never will); the component re-renders then, and only then. Returns
 * `null` on the server and for the first client render.
 *
 * @param wake Called with the clock time; may be a fresh closure on every render.
 */
export function useClockTick(
  wake: (nowMs: number) => number | null,
  options: UseClockTickOptions,
  getStore: () => ClockStore = defaultClockStore,
): number | null {
  const { key, inViewRef } = options;
  const inView = useInView(inViewRef);
  const wakeRef = useRef(wake);
  useEffect(() => {
    wakeRef.current = wake;
  });
  const tick = useRef<{ key: string | number; at: number } | null>(null);

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!inView) return () => undefined;
      return getStore().subscribe({
        nextChangeAt(now) {
          const wait = wakeRef.current(now);
          return wait === null ? null : now + wait;
        },
        notify() {
          tick.current = { key, at: getStore().now() };
          onChange();
        },
      });
    },
    [inView, key, getStore],
  );
  const read = useCallback((): number => {
    // A changed key reads the time afresh; otherwise the time of the last wake stands.
    if (tick.current?.key !== key) tick.current = { key, at: getStore().now() };
    return tick.current.at;
  }, [key, getStore]);

  return useSyncExternalStore(subscribe, read, () => null);
}

/**
 * The server-aligned time as of the latest step of `resolutionMs`, for callers that decide
 * something from the time itself (a lot opening) rather than print a countdown. The value is the
 * time at the step (just after it), not rounded, so a countdown worked out from it reads the true
 * whole second. `null` on the server and for the first client render.
 */
export function useClockNow(
  resolutionMs = 1000,
  options: { inViewRef?: RefObject<Element | null> | undefined } = {},
  getStore: () => ClockStore = defaultClockStore,
): number | null {
  return useClockTick(
    (now) => resolutionMs - (now % resolutionMs) + 1,
    { key: resolutionMs, inViewRef: options.inViewRef },
    getStore,
  );
}
