"use client";

import { useNow } from "@/hooks/use-now";
import { useEffect, useState } from "react";

/**
 * The server's time as the page should count against it, in milliseconds, ticking every second.
 * It starts at the server's own reading, so the first paint matches the server's render, then
 * keeps the offset between the server's clock and this device's so a skewed device clock never
 * shows the wrong time left.
 */
export function useServerClock(serverNowIso: string | null): number {
  const serverMs = serverNowIso ? Date.parse(serverNowIso) : Number.NaN;
  const [offsetMs, setOffsetMs] = useState(0);
  const tick = useNow();

  useEffect(() => {
    setOffsetMs(Number.isFinite(serverMs) ? serverMs - Date.now() : 0);
  }, [serverMs]);

  if (tick === null) return Number.isFinite(serverMs) ? serverMs : Date.now();
  return tick + offsetMs;
}
