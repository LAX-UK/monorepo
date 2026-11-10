"use client";

import { useClockTick } from "@auction/ui/clock";
import { defaultClockStore } from "@auction/ui/clock";

/** The page re-renders at least this often, so a "today" or "tomorrow" never goes stale. */
const MAX_STALE_MS = 60 * 60 * 1000;

/**
 * The lot page's structural clock: the server's time as of the last moment something about the
 * lot changed (it opens, it reaches zero) or an hour passed. The page does not re-render to tick;
 * the countdown leaves read the shared clock themselves. The first paint uses the server's own
 * reading so it matches the server render, and the shared clock starts from that reading until
 * it has measured the Bid API's clock.
 */
export function useLotPageNow(serverNowIso: string | null, moments: readonly number[]): number {
  const serverMs = serverNowIso ? Date.parse(serverNowIso) : Number.NaN;
  if (typeof window !== "undefined" && Number.isFinite(serverMs)) {
    defaultClockStore().source.seedProvisional(serverMs);
  }
  const tick = useClockTick(
    (now) => {
      let wait = MAX_STALE_MS;
      for (const moment of moments) {
        if (Number.isFinite(moment) && moment > now) wait = Math.min(wait, moment - now + 1);
      }
      return wait;
    },
    { key: moments.join("|") },
  );
  if (tick === null) return Number.isFinite(serverMs) ? serverMs : Date.now();
  return tick;
}
