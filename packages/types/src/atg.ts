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
  0: "Not yet offered",
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

/** Names lots in a blocker: up to three titles, then a count of the rest. */
function lotTitles(titles: string[]): string {
  const shown = titles.slice(0, 3).map((title) => `“${title}”`);
  const rest = titles.length - shown.length;
  if (rest > 0) return `${shown.join(", ")} and ${rest} more`;
  if (shown.length === 1) return shown[0] ?? "";
  return `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
}

/**
 * Why this sale is not ready to publish on ATG, from the admin view (push adds more). Lot sync
 * errors are left out: the tab reports them once, above everything else.
 */
export function atgReadinessBlockers(view: {
  sellingPlatform: AtgOwnershipState;
  saleCancelled: boolean;
  lastError: string | null;
  lots: Array<{ lotNumber: number | null; title: string }>;
}): string[] {
  const blockers: string[] = [];
  if (view.sellingPlatform === "lax") {
    blockers.push("This sale is published on lax.bid. Unpublish it there first.");
  }
  if (view.saleCancelled) {
    blockers.push("This sale is cancelled in LAX.");
  }
  const unnumbered = view.lots.filter((lot) => lot.lotNumber == null).map((lot) => lot.title);
  if (unnumbered.length > 0) {
    blockers.push(
      unnumbered.length === 1
        ? `${lotTitles(unnumbered)} needs a lot number.`
        : `${lotTitles(unnumbered)} need lot numbers.`,
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
  /** Where ATG lists the auction; only `public_marketplace` is shown on the public catalogue. */
  atgDistribution: AtgDistribution;
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
  /** When ATG staff approved the auction in Toolbox, as seen by the worker; null until then. */
  approvedAt: string | null;
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

/**
 * Small ownership summary for admin headers and list markers. Built by the API from the same
 * inputs as {@link resolveSaleSellingPlatform}, so it can never disagree with the server guards.
 */
export type AtgSaleSellingSummary = {
  sellingPlatform: AtgOwnershipState;
  /** The sale has an ATG auction id (it was created on ATG at least once). */
  linked: boolean;
  remoteStatus: AtgRemoteStatus | null;
  /** When ATG staff approved the auction in Toolbox; null until then. */
  approvedAt: string | null;
  soldLotCount: number;
};

/** ATG link state for one lot plus its sale's summary. `lot` is null when never sent to ATG. */
export type AtgLotSellingSummary = {
  saleId: string | null;
  sale: AtgSaleSellingSummary | null;
  lot: {
    /** GetLots `Status` stored as a decimal string. */
    remoteStatus: string | null;
    lastError: string | null;
    sold: boolean | null;
    numberOfBids: number | null;
  } | null;
};

/** Builds the summary from the ownership inputs; ownership always goes through the SSOT. */
export function toAtgSaleSellingSummary(
  input: ResolveSaleSellingPlatformInput & { atgApprovedAt: string | null },
): AtgSaleSellingSummary {
  return {
    sellingPlatform: resolveSaleSellingPlatform(input),
    linked: input.atgLinked,
    remoteStatus: input.atgRemoteStatus,
    approvedAt: input.atgApprovedAt,
    soldLotCount: input.atgSoldLotCount,
  };
}

export type AtgSellingBadge = {
  platform: "lax" | "atg";
  label: string;
  /** Plain-language explanation for the tooltip and screen readers. */
  description: string;
};

const ATG_BADGE_HINT =
  "Bidding happens on the ATG White Label (auctions.lax.bid). Publish, cancel and delete are disabled here.";

/**
 * Header badge for a sale. Null when the status badge already says it all (unlinked draft,
 * cancelled). Ownership comes from `sellingPlatform`; the ATG stage only refines the label.
 */
export function atgSaleSellingBadge(summary: AtgSaleSellingSummary): AtgSellingBadge | null {
  const { sellingPlatform, linked, remoteStatus, approvedAt } = summary;
  if (sellingPlatform === "cancelled") return null;
  if (sellingPlatform === "lax") {
    return {
      platform: "lax",
      label: "lax.bid",
      description: "Bidding happens on lax.bid. ATG push and publish are disabled for this sale.",
    };
  }
  if (sellingPlatform === "atg") {
    return remoteStatus === "published"
      ? { platform: "atg", label: "ATG · Live", description: ATG_BADGE_HINT }
      : {
          platform: "atg",
          label: "ATG · Ended",
          description:
            "The ATG auction closed with lots sold. The sale stays on ATG and is settled manually.",
        };
  }
  if (!linked) return null;
  if (remoteStatus === "closed") {
    return {
      platform: "atg",
      label: "ATG · Closed",
      description:
        "The ATG auction closed with nothing sold. The sale is free to publish on lax.bid.",
    };
  }
  const approved = approvedAt != null || remoteStatus === "approved";
  return {
    platform: "atg",
    label: approved ? "ATG · Approved" : "ATG · Draft",
    description: approved
      ? "ATG approved this auction. It is not published on ATG yet."
      : "This sale is on ATG as an unpublished draft. It is not taking bids anywhere yet.",
  };
}

/** Staff label for a lot pushed to ATG; known GetLots codes win, then sold and bid counts. */
export function atgLotStateLabel(lot: NonNullable<AtgLotSellingSummary["lot"]>): string | null {
  if (lot.lastError) return "Sync error";
  const documented = atgLotStatusLabel(lot.remoteStatus);
  if (documented) return documented;
  if (lot.sold) return "Sold";
  const bids = lot.numberOfBids ?? 0;
  if (bids > 0) return bids === 1 ? "1 bid" : `${bids} bids`;
  return null;
}

/** Header badge for a lot: its ATG state when linked, or lax.bid when its sale sells there. */
export function atgLotSellingBadge(summary: AtgLotSellingSummary): AtgSellingBadge | null {
  const salePlatform = summary.sale?.sellingPlatform;
  if (salePlatform === "lax") {
    return {
      platform: "lax",
      label: "lax.bid",
      description: "This lot sells on lax.bid with the rest of its sale.",
    };
  }
  if (salePlatform === "cancelled") return null;
  if (summary.lot) {
    const state = atgLotStateLabel(summary.lot);
    return {
      platform: "atg",
      label: state ? `On ATG · ${state}` : "On ATG",
      description: "This lot is listed on the ATG White Label (auctions.lax.bid).",
    };
  }
  return null;
}

/** Whether a list row gets the compact ATG marker (same rule as the header badge). */
export function isSaleOnAtg(summary: AtgSaleSellingSummary | null | undefined): boolean {
  return summary != null && atgSaleSellingBadge(summary)?.platform === "atg";
}

export function isLotOnAtg(summary: AtgLotSellingSummary | null | undefined): boolean {
  return summary != null && atgLotSellingBadge(summary)?.platform === "atg";
}
