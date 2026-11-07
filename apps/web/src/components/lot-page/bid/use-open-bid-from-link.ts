"use client";

import type { BidEntryControl, BidMode } from "@auction/domain";
import { useEffect, useRef } from "react";

/** The query that asks the lot page to open its bid dialog, as a lot card's "Bid £X" button does. */
export const OPEN_BID_PARAM = "bid";
export const OPEN_BID_VALUE = "open";

function takeOpenBidRequest(): boolean {
  const url = new URL(window.location.href);
  if (url.searchParams.get(OPEN_BID_PARAM) !== OPEN_BID_VALUE) return false;
  url.searchParams.delete(OPEN_BID_PARAM);
  window.history.replaceState(window.history.state, "", url);
  return true;
}

/**
 * Opens the one bid dialog once when the page was reached with `?bid=open`. It is mounted only
 * where the bid policies let the viewer bid, and it acts only on a main button that opens the
 * dialog and is not disabled; otherwise the viewer sees the page's own answer (sign in, register,
 * lot closed) and nothing opens. The request is dropped from the address either way.
 */
export function useOpenBidFromLink(
  primary: { control: BidEntryControl; disabledReason: string | null } | null,
  onOpen: (start: BidMode) => void,
): void {
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    if (!takeOpenBidRequest()) return;
    if (primary?.control.kind === "open_dialog" && !primary.disabledReason) {
      onOpen(primary.control.start);
    }
  }, [primary, onOpen]);
}
