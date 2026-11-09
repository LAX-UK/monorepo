"use client";

import { useClockNow } from "@/lib/time/use-clock";
import { defaultClockStore } from "@auction/ui/clock";

/**
 * The lot page's clock, in the server's time, stepping every second. The first paint uses the
 * server's own reading so it matches the server render; the shared clock starts from that same
 * reading until it has measured the Bid API's clock (see `server-clock-sync`).
 */
export function useLotPageNow(serverNowIso: string | null): number {
  const serverMs = serverNowIso ? Date.parse(serverNowIso) : Number.NaN;
  if (typeof window !== "undefined" && Number.isFinite(serverMs)) {
    defaultClockStore().source.seedProvisional(serverMs);
  }
  const tick = useClockNow(1000);
  if (tick === null) return Number.isFinite(serverMs) ? serverMs : Date.now();
  return tick;
}
