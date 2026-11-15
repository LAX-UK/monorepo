"use client";

import { useAnnounce } from "@/components/lot-page/lot-announcer";
import { useLotPageViewContext } from "@/components/lot-page/lot-page-view-context";
import { useLotBidHistory } from "@/lib/context/lot-bid-history-provider";
import { startClosingFetches } from "@/lib/lot-page/closing-result-fallback";
import {
  newTimeAnnouncementState,
  nextAnnouncementWake,
  nextTimeAnnouncements,
} from "@/lib/lot-page/time-announcements";
import { useClockTick } from "@auction/ui/clock";
import { useEffect, useRef } from "react";

/**
 * What the lot page does about time that is not drawing it: it says the marks (an hour, ten, five,
 * two and one minute), each extension, the close and the result in the page's one live region, and
 * when the clock reaches zero it asks the server for the result if the live connection has not
 * brought it. Draws nothing.
 */
export function LotTimeEffects() {
  const { live, view } = useLotPageViewContext();
  const announce = useAnnounce();
  const { refreshFromServer } = useLotBidHistory();
  const state = useRef(newTimeAnnouncementState());

  // No clock runs before the first live read: the close is not in the page (CO-7).
  const closes = live
    ? view.rows.find((row) => row.countdown?.kind === "closes")?.countdown
    : undefined;
  const endMs = closes?.targetMs ?? null;
  const extensions = closes?.extensions ?? 0;

  // Wakes at the next mark and at the close, and not otherwise.
  const nowMs = useClockTick(
    (now) => nextAnnouncementWake(state.current, { nowMs: now, endMs, lifecycle: view.lifecycle }),
    { key: `${endMs}|${view.lifecycle}` },
  );

  useEffect(() => {
    if (!live || nowMs === null) return;
    const said = nextTimeAnnouncements(state.current, {
      nowMs,
      endMs,
      lifecycle: view.lifecycle,
      extensions,
      visible: typeof document === "undefined" || document.visibilityState === "visible",
    });
    for (const message of said) announce(message);
  }, [live, nowMs, endMs, extensions, view.lifecycle, announce]);

  // Zero on a lot that is closing, or on one that should have opened: the page asks the server how
  // things stand rather than guessing, until the live connection or a snapshot says.
  const closing =
    live &&
    (view.lifecycle === "closing" ||
      (view.lifecycle === "scheduled" && view.msLeft !== null && view.msLeft <= 0));
  useEffect(() => {
    if (!closing) return;
    return startClosingFetches(() => refreshFromServer({ silent: true }));
  }, [closing, refreshFromServer]);

  return null;
}
