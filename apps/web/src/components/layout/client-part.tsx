"use client";

import { type ComponentType, useEffect, useState } from "react";

/** Waits before loading a part's code again after a failed or timed-out attempt (a dropped request, a deploy). */
export const CLIENT_PART_RETRY_MS = [1_000, 2_000, 4_000, 8_000] as const;

/** How long one attempt to load a part's code may take before it counts as failed. */
export const CLIENT_PART_ATTEMPT_TIMEOUT_MS = 10_000;

/**
 * A header part whose code is loaded in the browser only, drawn once it has arrived. It draws
 * nothing on the server and until then.
 *
 * The code is held in plain state, not behind `next/dynamic({ ssr: false })`. That puts a lazy
 * component in a Suspense boundary the server leaves to the browser, which failed two ways in
 * the header: a load that never settled left the boundary on its empty fallback for good, with
 * nothing in the console, and a failed load threw to the page's error boundary, so one missing
 * button replaced the whole page with "Something went wrong". Here each attempt that fails, or
 * takes longer than {@link CLIENT_PART_ATTEMPT_TIMEOUT_MS}, is followed by another after the
 * waits in {@link CLIENT_PART_RETRY_MS}, and then no more; the rest of the page is never
 * affected. A result that arrives after its attempt timed out is ignored.
 */
export function clientPart<Props extends object>(
  load: () => Promise<ComponentType<Props>>,
): ComponentType<Props> {
  // Shared by every place the part is drawn, so a second one does not load or wait again. It is
  // only set by an effect, so the first render in the browser always matches the server's.
  let loaded: ComponentType<Props> | null = null;

  function ClientPart(props: Props) {
    const [Part, setPart] = useState<ComponentType<Props> | null>(null);

    useEffect(() => {
      if (loaded) {
        const ready = loaded;
        setPart(() => ready);
        return;
      }
      let current = true;
      let retryTimer: ReturnType<typeof setTimeout> | undefined;
      let attemptTimer: ReturnType<typeof setTimeout> | undefined;
      const attempt = (failures: number) => {
        let settled = false;
        const fail = () => {
          if (settled) return;
          settled = true;
          clearTimeout(attemptTimer);
          const delay = CLIENT_PART_RETRY_MS[failures];
          if (current && delay !== undefined) {
            retryTimer = setTimeout(() => attempt(failures + 1), delay);
          }
        };
        attemptTimer = setTimeout(fail, CLIENT_PART_ATTEMPT_TIMEOUT_MS);
        load().then((component) => {
          if (settled) return;
          settled = true;
          clearTimeout(attemptTimer);
          loaded = component;
          if (current) setPart(() => component);
        }, fail);
      };
      attempt(0);
      return () => {
        current = false;
        clearTimeout(retryTimer);
        clearTimeout(attemptTimer);
      };
    }, [load]);

    return Part ? <Part {...props} /> : null;
  }
  return ClientPart;
}
