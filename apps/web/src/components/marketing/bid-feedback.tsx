"use client";

import { cn } from "@auction/ui";
import * as React from "react";

type BidFeedbackKind = "new-bid" | "outbid" | null;

export type BidFeedbackProps = {
  /** Bid amount as a number — used to detect changes and trigger feedback. */
  amount: number;
  /** When true, the user holds the current high bid (governs new-bid vs outbid feedback for OTHER bidders). */
  userIsHighBidder?: boolean;
  /** Render prop receives data attributes the consumer can spread on the card root. */
  children: (state: { dataProps: Record<string, string | undefined> }) => React.ReactNode;
};

/** F3b — Bid-feedback wrapper.
 *
 * Detects changes to `amount` and emits a transient class on the card root for
 * one animation cycle, via render-prop data props the consumer spreads. Built
 * on `Element.animate`-free CSS — the class drops back to default after the
 * animation duration via a timer.
 */
export function BidFeedback({ amount, userIsHighBidder = false, children }: BidFeedbackProps) {
  const [kind, setKind] = React.useState<BidFeedbackKind>(null);
  const previousRef = React.useRef<number>(amount);

  React.useEffect(() => {
    if (amount === previousRef.current) return;
    const next: BidFeedbackKind = userIsHighBidder ? "outbid" : "new-bid";
    setKind(next);
    previousRef.current = amount;
    const id = window.setTimeout(() => setKind(null), 1000);
    return () => window.clearTimeout(id);
  }, [amount, userIsHighBidder]);

  return (
    <>
      {children({
        dataProps: {
          "data-bid-feedback": kind ?? undefined,
        },
      })}
    </>
  );
}

/** Static class helper consumers compose with `data-bid-feedback`:
 *
 *   <article {...dataProps} className={cn(bidFeedbackClasses)}>
 *
 * - `new-bid`  → gold border pulse + diagonal sheen.
 * - `outbid`   → horizontal shake + red border.
 */
export const bidFeedbackClasses =
  "data-[bid-feedback=new-bid]:gold-pulse data-[bid-feedback=new-bid]:shimmer-sweep " +
  "data-[bid-feedback=outbid]:outbid-shake data-[bid-feedback=outbid]:ring-2 data-[bid-feedback=outbid]:ring-live-red";

/** Combine with a target className. */
export function withBidFeedbackClasses(...rest: Array<string | undefined | false>) {
  return cn(bidFeedbackClasses, ...rest);
}
