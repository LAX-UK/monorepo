"use client";

import { MarketingStickyBidBar } from "@/components/marketing/marketing-sticky-bid-bar";
import { SaleLifecycleBadge } from "@/components/marketing/sale-lifecycle-badge";
import { AddSaleToCalendarButton } from "@/components/sections/artwork/onsite/onsite-calendar-actions";
import { MARKETING_PAGE_INNER } from "@/lib/marketing/chrome";
import { saleAllowsWebBidding } from "@/lib/sale-mode";
import type { Sale, SaleDeliveryMode } from "@auction/types";
import { Countdown, LiveDot } from "@auction/ui";
import Link from "next/link";

type Props = {
  /** Bidding start instant. Required so we can render an "Opens in" countdown for upcoming sales. */
  start: Date;
  /** Bidding end instant. Used for "Closes in" countdown when live. */
  end: Date;
  /** Sale lifecycle — drives the label/CTA switch. */
  status: "draft" | "scheduled" | "active" | "ended" | "cancelled";
  saleTitle: string;
  deliveryMode?: SaleDeliveryMode;
  /** Optional live lots count — when present and live, surfaces a "{n} lots active" caption. */
  liveLotsCount?: number;
  /** External directions URL for onsite sales. */
  directionsUrl?: string | null;
  /** Live stream URL when sale is active. */
  streamUrl?: string | null;
  /** Full sale object for onsite calendar download. */
  sale?: Sale;
  locationLine?: string;
};

export function SaleMobileSummaryBar({
  start,
  end,
  status,
  saleTitle,
  deliveryMode = "online",
  liveLotsCount,
  directionsUrl,
  streamUrl,
  sale,
  locationLine = "",
}: Props) {
  if (status === "ended" || status === "cancelled") {
    return (
      <MarketingStickyBidBar innerClassName={MARKETING_PAGE_INNER}>
        <div className="min-w-0 flex flex-col gap-1">
          <SaleLifecycleBadge status={status} size="sm" />
          <span className="sr-only">{saleTitle}</span>
        </div>
        <Link
          href="#catalog"
          className="shrink-0 rounded-sm border border-outline-variant/40 px-4 py-3 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant"
        >
          View results
        </Link>
      </MarketingStickyBidBar>
    );
  }

  const isUpcoming = status === "scheduled" || status === "draft";
  const target = isUpcoming ? start : end;
  const kicker = isUpcoming ? "Opens in" : "Live sale";
  const isOnsite = !saleAllowsWebBidding(deliveryMode);

  const renderCta = () => {
    if (isOnsite) {
      if (!isUpcoming && streamUrl) {
        return (
          <a
            href={streamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-sm bg-cta-bg px-4 py-3 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-cta-on"
          >
            <LiveDot className="live-dot-pulse h-2 w-2" />
            Watch live
          </a>
        );
      }
      if (isUpcoming && sale) {
        return (
          <AddSaleToCalendarButton
            sale={sale}
            lotTitle={sale.title}
            locationLine={locationLine}
            className="h-auto shrink-0 rounded-sm px-4 py-3 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)]"
          />
        );
      }
      if (directionsUrl) {
        return (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-sm bg-cta-bg px-4 py-3 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-cta-on"
          >
            Get directions
          </a>
        );
      }
      return (
        <Link
          href="#plan-visit"
          className="shrink-0 rounded-sm bg-cta-bg px-4 py-3 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-cta-on"
        >
          Plan visit
        </Link>
      );
    }

    const ctaHref = isUpcoming ? "/register" : "#catalog";
    const ctaLabel = isUpcoming ? "Register" : "View lots";
    return (
      <Link
        href={ctaHref}
        className="shrink-0 rounded-sm bg-cta-bg px-4 py-3 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-cta-on"
      >
        {ctaLabel}
      </Link>
    );
  };

  return (
    <MarketingStickyBidBar innerClassName={MARKETING_PAGE_INNER}>
      <div className="min-w-0 flex flex-col gap-1">
        <SaleLifecycleBadge
          status={isUpcoming ? "scheduled" : "active"}
          {...(!isUpcoming ? { label: kicker } : {})}
          size="sm"
        />
        <span className="sr-only">{saleTitle}</span>
        <Countdown
          end={target}
          announce
          className="font-headline text-sm text-on-surface tabular-nums md:text-base"
        />
        {!isUpcoming && typeof liveLotsCount === "number" && liveLotsCount > 0 ? (
          <p className="mt-0.5 font-label text-[0.6rem] uppercase tracking-[0.18em] text-on-surface-variant">
            {liveLotsCount} lots active
          </p>
        ) : null}
      </div>
      {renderCta()}
    </MarketingStickyBidBar>
  );
}
