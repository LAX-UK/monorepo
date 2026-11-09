"use client";

import { defaultClockStore } from "@auction/ui/clock";
import { createServerClockSync } from "./server-clock-sync";
import { createBidApiTimeSource } from "./server-time-source.client";

let sync: ReturnType<typeof createServerClockSync> | null = null;
let stop: (() => void) | null = null;

/** The one sync for this tab, wired to the shared clock and the Bid API. */
export function browserClockSync() {
  sync ??= createServerClockSync({
    source: createBidApiTimeSource(),
    clock: defaultClockStore().source,
    monotonicNow: () => performance.now(),
  });
  return sync;
}

/**
 * Starts measuring the server's clock the first time a countdown needs it. Safe to call from
 * every countdown: only the first call does anything.
 */
export function ensureServerClockSync(): void {
  if (stop || typeof window === "undefined") return;
  stop = browserClockSync().start({
    isVisible: () => document.visibilityState !== "hidden",
    onVisibilityChange(callback) {
      document.addEventListener("visibilitychange", callback);
      return () => document.removeEventListener("visibilitychange", callback);
    },
    setInterval(callback, ms) {
      const id = window.setInterval(callback, ms);
      return () => window.clearInterval(id);
    },
    monotonicNow: () => performance.now(),
    wallNow: () => Date.now(),
    onResume(callback) {
      window.addEventListener("pageshow", callback);
      window.addEventListener("focus", callback);
      return () => {
        window.removeEventListener("pageshow", callback);
        window.removeEventListener("focus", callback);
      };
    },
    isNeeded: () => defaultClockStore().subscriberCount() > 0,
  });
  // A device that comes back online has most likely been away from the server.
  window.addEventListener("online", () => browserClockSync().notifyReconnected());
}
