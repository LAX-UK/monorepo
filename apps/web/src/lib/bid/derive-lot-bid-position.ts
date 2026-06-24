import type { AutoBidSettings } from "@/lib/data/contracts";
import type { LotLifecycleKind } from "@/lib/lot/lot-lifecycle";
import type { LotReserveContext } from "@/lib/lot/reserve-presentation";
import { leadingBelowReserve } from "@/lib/lot/reserve-presentation";
import type { Lot } from "@auction/types";

export type LotBidPositionKind =
  | "owner"
  | "notSignedIn"
  | "notBidding"
  | "winning"
  | "winningByAuto"
  | "leadingBelowReserve"
  | "outbid"
  | "inRunning"
  | "won"
  | "lost"
  | "noSale"
  | "cancelled"
  | "withdrawn"
  | "preLaunch"
  | "scheduled"
  | "endedOther";

export type LotBidAutoBidInfo = {
  max: string;
  step: string | null;
};

export type LotBidPosition =
  | { kind: "owner" }
  | { kind: "notSignedIn" }
  | { kind: "notBidding" }
  | { kind: "winning"; autoBid: LotBidAutoBidInfo | null }
  | { kind: "winningByAuto"; autoBid: LotBidAutoBidInfo }
  | { kind: "leadingBelowReserve"; autoBid: LotBidAutoBidInfo | null }
  | { kind: "outbid"; autoBid: LotBidAutoBidInfo | null }
  | { kind: "inRunning"; autoBid: LotBidAutoBidInfo | null }
  | { kind: "won"; hammerLabel: string }
  | { kind: "lost"; hammerLabel: string }
  | { kind: "noSale"; noSaleReason?: string | null }
  | { kind: "cancelled" }
  | { kind: "withdrawn" }
  | { kind: "preLaunch" }
  | { kind: "scheduled" }
  | { kind: "endedOther"; message: string };

export type DeriveLotBidPositionInput = {
  sessionUserId: string | null;
  sellerId: string | null;
  /** Server-resolved seller ownership (acting LE vs lot seller LE). */
  isOwnLot?: boolean;
  lotStatus: Lot["status"];
  lifecycleKind: LotLifecycleKind;
  leadingBidderId: string | null;
  winnerId: string | null;
  userHasBid: boolean;
  /** True when user was outbid (realtime event or SSR-derived). */
  outbidSignal: boolean;
  activeAutoBid: AutoBidSettings | null;
  endedBanner: string | null;
  reserveContext?: LotReserveContext;
  noSaleReason?: string | null;
};

function toAutoBidInfo(settings: AutoBidSettings | null): LotBidAutoBidInfo | null {
  if (!settings?.isActive || !settings.maxAutoBidAmount.trim()) return null;
  return {
    max: settings.maxAutoBidAmount,
    step: settings.autoBidStepAmount,
  };
}

/**
 * Single source of truth for the bidder's position on a lot page.
 * Drives summary UI, sticky bar badges, and aria-live copy.
 */
export function deriveLotBidPosition(input: DeriveLotBidPositionInput): LotBidPosition {
  const {
    sessionUserId,
    sellerId,
    isOwnLot = false,
    lotStatus,
    lifecycleKind,
    leadingBidderId,
    winnerId,
    userHasBid,
    outbidSignal,
    activeAutoBid,
    endedBanner,
    reserveContext = { hasReserve: false, reserveMet: null },
    noSaleReason,
  } = input;

  if (isOwnLot || (sellerId && sessionUserId && sessionUserId === sellerId)) {
    return { kind: "owner" };
  }

  if (!sessionUserId) {
    return { kind: "notSignedIn" };
  }

  switch (lifecycleKind) {
    case "cancelled":
      return { kind: "cancelled" };
    case "withdrawn":
      return { kind: "withdrawn" };
    case "preLaunch":
      return { kind: "preLaunch" };
    case "scheduled":
      return { kind: "scheduled" };
    case "endedNoSale":
      return { kind: "noSale", noSaleReason: noSaleReason ?? null };
    case "endedSold": {
      if (winnerId && sessionUserId === winnerId) {
        return { kind: "won", hammerLabel: endedBanner ?? "You won this lot." };
      }
      return { kind: "lost", hammerLabel: endedBanner ?? "This lot has sold." };
    }
    default:
      break;
  }

  if (lotStatus !== "active") {
    if (endedBanner) {
      return { kind: "endedOther", message: endedBanner };
    }
    return { kind: "endedOther", message: "Bidding has ended on this lot." };
  }

  const autoBid = toAutoBidInfo(activeAutoBid);
  const isLeading = Boolean(leadingBidderId && sessionUserId && leadingBidderId === sessionUserId);

  if (isLeading) {
    if (leadingBelowReserve(reserveContext, true)) {
      return { kind: "leadingBelowReserve", autoBid: toAutoBidInfo(activeAutoBid) };
    }
    if (autoBid) {
      return { kind: "winningByAuto", autoBid };
    }
    return { kind: "winning", autoBid: null };
  }

  if (outbidSignal || (userHasBid && !isLeading)) {
    if (outbidSignal) {
      return { kind: "outbid", autoBid };
    }
    return { kind: "inRunning", autoBid };
  }

  return { kind: "notBidding" };
}

/** Compact label for sticky bar / badges. */
export function lotBidPositionStickyLabel(
  position: LotBidPosition,
  reserveContext?: LotReserveContext,
): string | null {
  if (position.kind === "leadingBelowReserve") return "High bid";
  if (
    reserveContext &&
    (position.kind === "winning" || position.kind === "winningByAuto") &&
    leadingBelowReserve(reserveContext, true)
  ) {
    return "High bid";
  }
  switch (position.kind) {
    case "winning":
    case "winningByAuto":
      return "Winning";
    case "outbid":
      return "Outbid";
    case "inRunning":
      return "Behind";
    case "won":
      return "Won";
    case "lost":
      return "Closed";
    default:
      return null;
  }
}

/** Whether sticky bar should show outbid CTA. */
export function lotBidPositionShowOutbidCta(position: LotBidPosition): boolean {
  return position.kind === "outbid";
}

/** Auto-bid label for sticky bar, e.g. "Auto £1,000". */
export function lotBidPositionAutoStickyLabel(
  position: LotBidPosition,
  format: (amount: string) => string,
): string | null {
  const auto =
    position.kind === "winning" ||
    position.kind === "winningByAuto" ||
    position.kind === "leadingBelowReserve" ||
    position.kind === "outbid" ||
    position.kind === "inRunning"
      ? position.autoBid
      : null;
  if (!auto?.max) return null;
  return `Auto ${format(auto.max)}`;
}
