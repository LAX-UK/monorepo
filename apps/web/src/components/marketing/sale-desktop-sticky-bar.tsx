"use client";

import { saleAllowsWebBidding } from "@/lib/sale-mode";
import type { SaleDeliveryMode } from "@auction/types";
import { Countdown, LiveDot, cn } from "@auction/ui";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Props = {
  /** Bidding start instant (for the "Opens in" countdown on upcoming sales). */
  start: Date;
  /** Bidding end instant (for the "Closes in" countdown when live). */
  end: Date;
  status: "draft" | "scheduled" | "active" | "ended" | "cancelled";
  saleTitle: string;
  deliveryMode?: SaleDeliveryMode;
  streamUrl?: string | null;
  /** Optional live lot count surfaced as a caption when the sale is live. */
  liveLotsCount?: number;
  /** Register affordance target for signed-in buyers (defaults to /register). */
  registerHref?: string;
  isAuthenticated?: boolean;
};

/** Desktop (`lg+`) sticky action bar for the sale page. Reveals after the hero
 * scrolls out of view and mirrors the mobile summary bar's countdown + CTA. */
export function SaleDesktopStickyBar({
  start,
  end,
  status,
  saleTitle,
  deliveryMode = "online",
  streamUrl = null,
  liveLotsCount,
  registerHref = "/register",
  isAuthenticated = false,
}: Props) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setPinned(entry ? entry.boundingClientRect.top < 0 && !entry.isIntersecting : false);
      },
      { threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const isEnded = status === "ended" || status === "cancelled";
  const isUpcoming = status === "scheduled" || status === "draft";
  const isOnsite = !saleAllowsWebBidding(deliveryMode);
  const target = isUpcoming ? start : end;

  const renderCta = () => {
    if (isEnded) {
      return (
        <Link
          href="#catalog"
          className="inline-flex items-center rounded-sm border border-outline-variant/40 px-5 py-2.5 font-label text-xs font-bold uppercase tracking-[0.22em] text-on-surface-variant transition-colors hover:border-link/40 hover:text-link"
        >
          View results
        </Link>
      );
    }
    if (isOnsite && !isUpcoming && streamUrl) {
      return (
        <a
          href={streamUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-sm bg-cta-bg px-5 py-2.5 font-label text-xs font-bold uppercase tracking-[0.22em] text-cta-on"
        >
          <LiveDot className="live-dot-pulse h-2 w-2" />
          Watch live
        </a>
      );
    }
    if (isOnsite) {
      return (
        <Link
          href="#plan-visit"
          className="inline-flex items-center rounded-sm bg-cta-bg px-5 py-2.5 font-label text-xs font-bold uppercase tracking-[0.22em] text-cta-on"
        >
          Plan your visit
        </Link>
      );
    }
    if (isUpcoming) {
      return (
        <Link
          href={isAuthenticated ? registerHref : "/register"}
          className="inline-flex items-center rounded-sm bg-cta-bg px-5 py-2.5 font-label text-xs font-bold uppercase tracking-[0.22em] text-cta-on"
        >
          Register to bid
        </Link>
      );
    }
    return (
      <Link
        href="#catalog"
        className="inline-flex items-center rounded-sm bg-cta-bg px-5 py-2.5 font-label text-xs font-bold uppercase tracking-[0.22em] text-cta-on"
      >
        Browse lots
      </Link>
    );
  };

  return (
    <>
      <div ref={sentinelRef} aria-hidden className="h-px w-full" />
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-[var(--z-site-chrome,50)] hidden border-t border-outline-variant/25 bg-surface-container-lowest/95 backdrop-blur-md transition-transform duration-300 lg:block dark:border-outline-variant/20",
          pinned ? "translate-y-0" : "pointer-events-none translate-y-full",
        )}
        aria-hidden={!pinned}
      >
        <div className="mx-auto flex max-w-[var(--container-max,1440px)] items-center justify-between gap-6 px-8 py-3 md:px-10 lg:px-14">
          <div className="flex min-w-0 items-center gap-6">
            <p className="truncate font-headline text-base font-semibold text-on-surface">
              {saleTitle}
            </p>
            {!isEnded ? (
              <div className="flex shrink-0 items-baseline gap-2">
                <span className="font-label text-[0.65rem] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                  {isUpcoming ? "Opens in" : "Closes in"}
                </span>
                <Countdown
                  end={target}
                  announce={false}
                  className="font-headline text-base font-semibold tabular-nums text-on-surface"
                />
              </div>
            ) : null}
            {!isUpcoming && !isEnded && typeof liveLotsCount === "number" && liveLotsCount > 0 ? (
              <span className="hidden shrink-0 font-label text-[0.65rem] uppercase tracking-[0.18em] text-on-surface-variant xl:inline">
                {liveLotsCount} lots live
              </span>
            ) : null}
          </div>
          <div className="shrink-0">{renderCta()}</div>
        </div>
      </div>
    </>
  );
}
