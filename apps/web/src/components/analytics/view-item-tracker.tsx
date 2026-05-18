"use client";

import { type TrackViewItemInput, trackViewItem } from "@/lib/analytics/events";
import { useEffect, useRef } from "react";

export function ViewItemTracker({
  lotId,
  title,
  priceMinor,
  currency = "GBP",
}: TrackViewItemInput) {
  const fired = useRef<string | null>(null);

  useEffect(() => {
    if (fired.current === lotId) return;
    fired.current = lotId;
    trackViewItem({
      lotId,
      title,
      currency,
      ...(priceMinor != null ? { priceMinor } : {}),
    });
  }, [lotId, title, priceMinor, currency]);

  return null;
}
