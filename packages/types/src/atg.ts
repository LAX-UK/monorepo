import type { SaleStatus } from "./sale.js";

/** LAX-side lifecycle of a sale pushed to the ATG White Label. */
export type AtgRemoteStatus = "pending" | "created" | "approved" | "published" | "closed";

export type AtgSyncAction = "push" | "publish" | "close";

/** ATG allows only these auction types for LAX. */
export const ATG_AUCTION_TYPES = ["Timed", "Live"] as const;
export type AtgAuctionType = (typeof ATG_AUCTION_TYPES)[number];

/**
 * Where ATG lists the auction. `private_test` sends `Private: true` (hidden from public
 * listings); `public_marketplace` lists it on both the White Label and The Saleroom. ATG has not
 * confirmed a public White-Label-only mode, so none is offered.
 */
export const ATG_DISTRIBUTIONS = ["private_test", "public_marketplace"] as const;
export type AtgDistribution = (typeof ATG_DISTRIBUTIONS)[number];

export type AtgSaleSettings = {
  auctionType: AtgAuctionType;
  distribution: AtgDistribution;
};

export const DEFAULT_ATG_SALE_SETTINGS: AtgSaleSettings = {
  auctionType: "Timed",
  distribution: "private_test",
};

/** The auction type is fixed once ATG has created the auction. */
export function canChangeAtgAuctionType(state: { linked: boolean }): boolean {
  return !state.linked;
}

/**
 * GetLots `Status` integers ATG documented (Oct 2026). `3` is not in the table.
 * GetSaleResults uses the string names.
 */
export const ATG_LOT_STATUSES = {
  0: "WaitingToBeOffered",
  1: "Offered",
  2: "NotSold",
  4: "Sold",
} as const;

const ATG_LOT_STATUS_LABEL: Record<keyof typeof ATG_LOT_STATUSES, string> = {
  0: "Waiting",
  1: "Offered",
  2: "Not sold",
  4: "Sold",
};

/** Staff label for a documented lot status, or null when the code is missing or unknown. */
export function atgLotStatusLabel(status: string | number | null | undefined): string | null {
  if (status == null || status === "") return null;
  const code = typeof status === "number" ? status : Number(status);
  if (!Number.isInteger(code)) return null;
  return ATG_LOT_STATUS_LABEL[code as keyof typeof ATG_LOT_STATUSES] ?? null;
}

/** Distribution can change until the auction is published (post-publish semantics unconfirmed). */
export function canChangeAtgDistribution(state: { remoteStatus: AtgRemoteStatus | null }): boolean {
  return state.remoteStatus !== "published" && state.remoteStatus !== "closed";
}

/** Why this sale is not ready to publish on ATG, from the admin view (push adds more). */
export function atgReadinessBlockers(view: {
  sellingPlatform: AtgOwnershipState;
  saleCancelled: boolean;
  lastError: string | null;
  lots: Array<{ lotNumber: number | null; lastError: string | null }>;
}): string[] {
  const blockers: string[] = [];
  if (view.sellingPlatform === "lax") {
    blockers.push("This sale is published on lax.bid. Unpublish it there first.");
  }
  if (view.saleCancelled) {
    blockers.push("This sale is cancelled in LAX.");
  }
  const unnumbered = view.lots.filter((lot) => lot.lotNumber == null).length;
  if (unnumbered > 0) {
    blockers.push(
      unnumbered === 1 ? "1 lot needs a lot number." : `${unnumbered} lots need a lot number.`,
    );
  }
  const lotErrors = view.lots.filter((lot) => lot.lastError).length;
  if (lotErrors > 0) {
    blockers.push(
      lotErrors === 1 ? "1 lot has a sync error." : `${lotErrors} lots have a sync error.`,
    );
  }
  if (view.lastError?.includes("did not confirm the new auction")) {
    blockers.push("The last create may have reached ATG. Check Toolbox before pushing again.");
  }
  return blockers;
}

/** Which platform may take bids for this sale (computed; not stored). */
export type AtgSellingPlatform = "free" | "lax" | "atg";

export type AtgOwnershipState = AtgSellingPlatform | "cancelled";

export type ResolveSaleSellingPlatformInput = {
  saleStatus: SaleStatus;
  atgRemoteStatus: AtgRemoteStatus | null;
  /** At least one row in `atg_auction_link`. */
  atgLinked: boolean;
  atgSoldLotCount: number;
};

/**
 * Single source of truth for the one-platform-per-sale rule.
 * LAX draft + ATG draft/closed-with-no-sales => free; LAX published => lax; ATG published or closed-with-sales => atg.
 */
export function resolveSaleSellingPlatform(
  input: ResolveSaleSellingPlatformInput,
): AtgOwnershipState {
  const { saleStatus, atgRemoteStatus, atgLinked, atgSoldLotCount } = input;
  if (saleStatus === "cancelled") return "cancelled";
  if (saleStatus === "scheduled" || saleStatus === "active" || saleStatus === "ended") {
    return "lax";
  }
  if (!atgLinked) return "free";
  if (atgRemoteStatus === "published") return "atg";
  if (atgRemoteStatus === "closed" && atgSoldLotCount >= 1) return "atg";
  return "free";
}

export function canPublishSaleOnLax(state: AtgOwnershipState): boolean {
  return state === "free";
}

export function canPushOrPublishSaleOnAtg(state: AtgOwnershipState): boolean {
  return state !== "cancelled" && state !== "lax";
}

export type AtgSaleOwnershipSnapshot = {
  saleStatus: SaleStatus;
  atgRemoteStatus: AtgRemoteStatus | null;
  atgLinked: boolean;
  atgSoldLotCount: number;
  sellingPlatform: AtgOwnershipState;
};

export type AtgLotChannelState = {
  linked: boolean;
  numberOfBids: number;
  sold: boolean;
};

export type AtgIntegrationStatus = {
  enabled: boolean;
  whiteLabelBaseUrl: string | null;
};

/** BullMQ job visibility for the admin ATG tab. */
export type AtgSyncJobState = "waiting" | "active" | "failed" | "done";

/** One `GetSaleResults` row as stored by the worker (no bidder names). */
export type AtgSaleResultRow = {
  atgLotId: string | null;
  lotNumber: string | null;
  lotStatus: string | null;
  numberOfBids: number | null;
  paddleNumber: string | null;
  hammerPrice: number | null;
  totalHammerPrice: number | null;
  endTimeUtc: string | null;
};

export type AtgLotSyncView = {
  lotId: string;
  lotNumber: number | null;
  title: string;
  atgLotId: string | null;
  imageCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
  /** GetLots `Status` stored as a decimal string (`0`, `1`, `2`, `4`, or an unknown code). */
  remoteStatus: string | null;
  sold: boolean | null;
  hammerPrice: string | null;
  currentMaxBid: string | null;
  numberOfBids: number | null;
  lastPolledAt: string | null;
};

export type AtgSaleSyncView = {
  saleId: string;
  saleStatus: SaleStatus;
  sellingPlatform: AtgOwnershipState;
  /** Cancelled in LAX: push and publish are refused; a linked auction can still be closed. */
  saleCancelled: boolean;
  linked: boolean;
  atgAuctionId: string | null;
  remoteStatus: AtgRemoteStatus | null;
  publishedAt: string | null;
  closedAt: string | null;
  lastSyncedAt: string | null;
  lastPolledAt: string | null;
  lastError: string | null;
  settings: AtgSaleSettings;
  settingsUpdatedAt: string | null;
  results: AtgSaleResultRow[];
  lots: AtgLotSyncView[];
};
