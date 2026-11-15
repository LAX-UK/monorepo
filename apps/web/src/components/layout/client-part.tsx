"use client";

import { type ComponentType, useEffect, useState } from "react";

/** Waits before fetching a part's code again after a failed fetch (a dropped request, a deploy). */
export const CLIENT_PART_RETRY_MS = [1_000, 2_000, 4_000, 8_000] as const;

/**
 * A header part whose code is fetched in the browser only, drawn once it has arrived. It draws
 * nothing on the server and until then.
 *
 * The code is held in plain state, not behind `next/dynamic({ ssr: false })`. That puts a lazy
 * component in a Suspense boundary the server leaves to the browser, which failed two ways in
 * the header: a fetch that never settled left the boundary on its empty fallback for good, with
 * nothing in the console, and a failed fetch threw to the page's error boundary, so one missing
 * button replaced the whole page with "Something went wrong". Here a failed fetch is tried again
 * a few times (see {@link CLIENT_PART_RETRY_MS}) and the rest of the page is never affected.
 */
export function clientPart<Props extends object>(
  load: () => Promise<ComponentType<Props>>,
): ComponentType<Props> {
  // Shared by every place the part is drawn, so a second one does not fetch or wait again. It is
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
      const attempt = (failures: number) => {
        load().then(
          (component) => {
            loaded = component;
            if (current) setPart(() => component);
          },
          () => {
            const delay = CLIENT_PART_RETRY_MS[failures];
            if (current && delay !== undefined) {
              retryTimer = setTimeout(() => attempt(failures + 1), delay);
            }
          },
        );
      };
      attempt(0);
      return () => {
        current = false;
        if (retryTimer !== undefined) clearTimeout(retryTimer);
      };
    }, [load]);

    return Part ? <Part {...props} /> : null;
  }
  return ClientPart;
}
