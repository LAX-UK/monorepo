"use client";

import { Countdown, StickyBidBar } from "@auction/ui";
import Link from "next/link";

type Props = {
  /** Bidding start instant. Required so we can render an "Opens in" countdown for upcoming sales. */
  start: Date;
  /** Bidding end instant. Used for "Closes in" countdown when live. */
  end: Date;
  /** Sale lifecycle — drives the label/CTA switch. */
  status: "draft" | "scheduled" | "active" | "ended" | "cancelled";
  saleTitle: string;
};

export function SaleMobileSummaryBar({ start, end, status, saleTitle }: Props) {
  if (status === "ended" || status === "cancelled") {
    return (
      <StickyBidBar className="lg:hidden" innerClassName="max-w-screen-2xl">
        <div className="min-w-0">
          <p className="font-label text-[0.65rem] uppercase tracking-widest text-on-surface-variant">
            Sale {status === "ended" ? "ended" : "cancelled"}
            <span className="sr-only"> · {saleTitle}</span>
          </p>
        </div>
        <Link
          href="#catalog"
          className="shrink-0 rounded-sm border border-outline-variant/40 px-4 py-3 font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant"
        >
          View results
        </Link>
      </StickyBidBar>
    );
  }

  const isUpcoming = status === "scheduled" || status === "draft";
  const target = isUpcoming ? start : end;
  const kicker = isUpcoming ? "Opens in" : "Live sale";
  const ctaHref = isUpcoming ? "/register" : "#catalog";
  const ctaLabel = isUpcoming ? "Register" : "View lots";

  return (
    <StickyBidBar className="lg:hidden" innerClassName="max-w-screen-2xl">
      <div className="min-w-0">
        <p className="font-label text-[0.65rem] uppercase tracking-widest text-on-surface-variant">
          {kicker}
          <span className="sr-only"> · {saleTitle}</span>
        </p>
        <Countdown
          end={target}
          announce
          className="font-headline text-sm text-on-surface tabular-nums md:text-base"
        />
      </div>
      <Link
        href={ctaHref}
        className="shrink-0 rounded-sm bg-cta-bg px-4 py-3 font-label text-xs font-bold uppercase tracking-widest text-cta-on"
      >
        {ctaLabel}
      </Link>
    </StickyBidBar>
  );
}
