"use client";

import { recordRecentlyViewedLot } from "@/lib/marketing/recently-viewed-lots";
import { useEffect, useRef } from "react";

type Props = {
  lotId: string;
  href: string;
  title: string;
};

/** Records lot detail views in the recently-viewed localStorage ring buffer. */
export function RecentlyViewedTracker({ lotId, href, title }: Props) {
  const fired = useRef<string | null>(null);

  useEffect(() => {
    if (fired.current === lotId) return;
    fired.current = lotId;
    recordRecentlyViewedLot({ id: lotId, href, title });
  }, [lotId, href, title]);

  return null;
}
