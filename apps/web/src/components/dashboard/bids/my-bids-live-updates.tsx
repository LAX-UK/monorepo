"use client";

import {
  type LiveLotRef,
  bidUpdateAnnouncement,
  lotClosedAnnouncement,
} from "@/lib/bid/my-bids-live";
import { useLotPortsOptional } from "@/lib/context/lot-ports";
import type { LotRealtimePort } from "@/lib/realtime/contracts";
import { createSocketLotRealtime } from "@/lib/realtime/socket-adapter";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

/** Several bids in a burst refresh the page once. */
const REFRESH_DEBOUNCE_MS = 600;
/** A fallback refresh in case the live connection drops silently. */
const FALLBACK_REFRESH_MS = 60_000;

type Props = {
  userId: string;
  lots: readonly LiveLotRef[];
  /** The live feed; the page's lot port, else the shared socket. Injected in tests. */
  realtime?: LotRealtimePort;
};

/**
 * Keeps My bids current while lots are open: each bid or close on a listed lot refreshes the
 * page's figures and is announced politely to screen readers ("You've been outbid on lot 14").
 * Renders only the live region.
 */
export function MyBidsLiveUpdates({ userId, lots, realtime: injected }: Props) {
  const router = useRouter();
  const ports = useLotPortsOptional();
  const [message, setMessage] = useState("");
  const lotKey = lots.map((lot) => lot.lotId).join(",");
  // Re-subscribe only when the set of open lots changes, not on every render.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the lot ids
  const stableLots = useMemo(() => lots, [lotKey]);
  const refreshTimer = useRef<number | null>(null);

  useEffect(() => {
    if (stableLots.length === 0) return;
    const realtime = injected ?? ports?.realtime ?? createSocketLotRealtime();
    const refreshSoon = () => {
      if (refreshTimer.current != null) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => router.refresh(), REFRESH_DEBOUNCE_MS);
    };
    const unsubscribes = stableLots.map((lot) =>
      realtime.subscribeToLot(lot.lotId, {
        onBidUpdate: (event) => {
          setMessage(bidUpdateAnnouncement(event, lot, userId));
          refreshSoon();
        },
        onLotExtended: refreshSoon,
        onLotEnded: () => {
          setMessage(lotClosedAnnouncement(lot));
          refreshSoon();
        },
        onReconnect: refreshSoon,
      }),
    );
    const fallback = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, FALLBACK_REFRESH_MS);
    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe();
      window.clearInterval(fallback);
      if (refreshTimer.current != null) window.clearTimeout(refreshTimer.current);
    };
  }, [stableLots, injected, ports, router, userId]);

  return (
    <output aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </output>
  );
}
