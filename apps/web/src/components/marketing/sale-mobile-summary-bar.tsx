"use client";

import { CountdownFadeSlot } from "@/components/marketing/countdown-fade-slot";
import { MarketingStickyBidBar } from "@/components/marketing/marketing-sticky-bid-bar";
import { SaleLifecycleBadge } from "@/components/marketing/sale-lifecycle-badge";
import { SaleroomMobileSummaryBar } from "@/components/marketing/saleroom-mobile-summary-bar";
import { AddSaleToCalendarButton } from "@/components/sections/artwork/onsite/onsite-calendar-actions";
import { useSalePhoneBarVisible } from "@/hooks/use-sale-phone-bar-visible";
import { useSaleroomLive } from "@/lib/context/saleroom-live-provider";
import { formatLondonWhen } from "@/lib/datetime/london-time";
import { saleAllowsWebBidding } from "@/lib/sale-mode";
import { useActiveSaleCountdownEndIso } from "@/lib/sale/use-active-sale-countdown-end-iso";
import {
  type SaleroomLotRef,
  resolveSaleroomMobileSummaryBarMode,
} from "@/lib/saleroom/saleroom-mobile-chrome";
import { closingChipText, opensLine } from "@/lib/time/opens-line";
import { useClientClock } from "@/lib/time/use-client-clock";
import type { Sale, SaleDeliveryMode } from "@auction/types";
import { Countdown, LiveDot } from "@auction/ui";
import { Button } from "@auction/ui/lax";
import Link from "next/link";

/** When a sale opens, by the time rule: the date beyond a week, then days, hours and minutes. */
function OpensText({ start }: { start: Date }) {
  const nowMs = useClientClock(60_000);
  const line =
    nowMs != null
      ? opensLine(start, new Date(nowMs))
      : { label: "Opens", value: formatLondonWhen(start) };
  return (
    <p className="m-0 text-lax-13 leading-5 text-lax-fg">
      <span className="text-lax-muted">{line.label} </span>
      <span className="font-semibold tabular-nums" suppressHydrationWarning>
        {line.value}
      </span>
    </p>
  );
}

type Props = {
  /** Bidding start instant. Required so we can render an "Opens in" countdown for upcoming sales. */
  start: Date;
  /** Bidding end instant. Used for "Closes in" countdown when live. */
  end: Date;
  /** Sale lifecycle — drives the label/CTA switch. */
  status: "draft" | "scheduled" | "active" | "ended" | "cancelled" | "voided";
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
  /** Hybrid saleroom lot refs for on-block bottom bar CTA. */
  saleroomLotRefs?: readonly SaleroomLotRef[];
  /** When false (staff viewers), suppress register/bid CTAs. Defaults to true. */
  canParticipate?: boolean;
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
  saleroomLotRefs = [],
  canParticipate = true,
}: Props) {
  const saleroomLive = useSaleroomLive();
  const heroActionsScrolledOut = useSalePhoneBarVisible();
  const reactiveLiveEndIso = useActiveSaleCountdownEndIso({
    status,
    endTime: end,
    deliveryMode,
    ...(status === "active" ? { initialEndIso: end.toISOString() } : {}),
  });
  const saleroomMode =
    status === "active" && deliveryMode === "hybrid" && saleroomLotRefs.length > 0 && saleroomLive
      ? resolveSaleroomMobileSummaryBarMode(
          saleroomLive.status,
          saleroomLive.currentLotId,
          saleroomLotRefs,
        )
      : null;

  // The hero's own actions are on screen first; the bar takes over once they scroll out. A sale
  // with no such row (ended, or handled elsewhere) has nothing to wait for, so its bar shows at once.
  if (!heroActionsScrolledOut) return null;

  if (status === "ended" || status === "cancelled" || status === "voided") {
    return (
      <MarketingStickyBidBar>
        <div className="min-w-0 flex flex-col gap-1">
          <SaleLifecycleBadge status={status} />
          <span className="sr-only">{saleTitle}</span>
        </div>
        <Button variant="secondary" size="lg" asChild>
          <Link href="#catalog">View results</Link>
        </Button>
      </MarketingStickyBidBar>
    );
  }

  if (saleroomMode?.kind === "on_block" || saleroomMode?.kind === "paused") {
    return (
      <SaleroomMobileSummaryBar
        mode={saleroomMode}
        saleTitle={saleTitle}
        canParticipate={canParticipate}
      />
    );
  }

  const isUpcoming = status === "scheduled" || status === "draft";
  const target = isUpcoming ? start : end;
  const kicker = isUpcoming ? "Opens in" : "Live sale";
  const isOnsite = !saleAllowsWebBidding(deliveryMode);

  const showCountdown =
    isUpcoming || deliveryMode === "online" || (status === "active" && reactiveLiveEndIso != null);

  const renderCta = () => {
    if (isOnsite) {
      if (!isUpcoming && streamUrl) {
        return (
          <Button variant="primary" size="lg" asChild>
            <a href={streamUrl} target="_blank" rel="noopener noreferrer">
              <LiveDot className="live-dot-pulse h-2 w-2" />
              Watch live
            </a>
          </Button>
        );
      }
      if (isUpcoming && sale) {
        return (
          <AddSaleToCalendarButton
            sale={sale}
            lotTitle={sale.title}
            locationLine={locationLine}
            className="shrink-0"
          />
        );
      }
      if (directionsUrl) {
        return (
          <Button variant="primary" size="lg" asChild>
            <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
              Get directions
            </a>
          </Button>
        );
      }
      return (
        <Button variant="primary" size="lg" asChild>
          <Link href="#plan-visit">Plan visit</Link>
        </Button>
      );
    }

    const ctaHref = isUpcoming ? (canParticipate ? "/register" : "#catalog") : "#catalog";
    const ctaLabel = isUpcoming ? (canParticipate ? "Register" : "View lots") : "View lots";
    return (
      <Button variant="primary" size="lg" asChild>
        <Link href={ctaHref}>{ctaLabel}</Link>
      </Button>
    );
  };

  return (
    <MarketingStickyBidBar>
      <div className="min-w-0 flex flex-col gap-1">
        <SaleLifecycleBadge
          status={isUpcoming ? "scheduled" : "active"}
          {...(isUpcoming ? { opensAt: start } : { label: kicker })}
        />
        <span className="sr-only">{saleTitle}</span>
        {isUpcoming ? <OpensText start={start} /> : null}
        <CountdownFadeSlot visible={showCountdown && !isUpcoming}>
          {showCountdown && !isUpcoming ? (
            <Countdown
              end={target}
              format={closingChipText}
              announce={isUpcoming || deliveryMode === "online"}
              className="font-lax text-lax-13 font-semibold text-lax-fg tabular-nums"
            />
          ) : null}
        </CountdownFadeSlot>
        {saleroomMode?.kind === "live_no_lot" ? (
          <p className="m-0 text-lax-13 leading-5 text-lax-muted">
            Saleroom live · {saleroomMode.progressLabel}
          </p>
        ) : !isUpcoming && typeof liveLotsCount === "number" && liveLotsCount > 0 ? (
          <p className="m-0 text-lax-13 leading-5 text-lax-muted">{liveLotsCount} lots active</p>
        ) : null}
      </div>
      {renderCta()}
    </MarketingStickyBidBar>
  );
}
