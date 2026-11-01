import { type PublicBidHistory, toPublicBidHistory } from "@auction/domain";
import type { ListLotsFilter } from "@auction/persistence/interfaces";
import type { Lot, PublicLotView, StaffRoles, UserRole } from "@auction/types";
import { roleHasCapability } from "@auction/types";
import { resolvePublicLotListFilter, viewerCanSeeNonPublicCatalog } from "@auction/validators";
import { lotBidderRef } from "../../lib/lot-bidder-ref.js";
import { maskLotForPublicView } from "../../lib/lot-public-view.js";
import { presentLotsImages } from "../../lib/media-presenters.js";
import { withAtgLotStates } from "../sale-selling-platform.js";
import { clampLotBidsLimitQuery } from "./lot-read.js";
import type {
  ListBidsForPublicApiResult,
  LotBidPublicApiRow,
  LotServiceDeps,
} from "./lot-types.js";

export async function listLotsForPublicApi(
  deps: LotServiceDeps,
  filter: ListLotsFilter,
  viewerRole: string | undefined,
  viewerStaffRoles?: StaffRoles | undefined,
): Promise<{ data: (Lot | PublicLotView)[] }> {
  const viewerCanSeeNonPublic = viewerCanSeeNonPublicCatalog(viewerRole, viewerStaffRoles);
  const resolved = resolvePublicLotListFilter({
    status: filter.status,
    statuses: filter.statuses,
    viewerCanSeeNonPublic,
  });
  const queryFilter: ListLotsFilter = {
    ...filter,
    ...(resolved.statuses !== undefined
      ? { statuses: resolved.statuses, status: undefined }
      : resolved.status !== undefined
        ? { status: resolved.status, statuses: undefined }
        : {}),
    ...(!viewerCanSeeNonPublic ? { requirePublicParentSale: true } : {}),
  };

  if (!viewerCanSeeNonPublic && !deps.saleRepo && process.env.NODE_ENV !== "test") {
    console.warn(
      "[listLotsForPublicApi] saleRepo unavailable; requirePublicParentSale relies on SQL only",
    );
  }

  const rows = await withAtgLotStates(
    viewerCanSeeNonPublic ? null : deps.saleChannelReader,
    await deps.lotRepo.list(queryFilter),
  );

  const resolveImages = filter.resolveImages !== false;
  const presented = resolveImages
    ? await presentLotsImages(deps.catalogueMediaUrlResolver, rows, deps.mediaAssetEnricher)
    : rows;
  return {
    data: presented.map((lotRow) => maskLotForPublicView(lotRow, viewerRole, viewerStaffRoles)),
  };
}

export async function listBidsForPublicApi(
  deps: LotServiceDeps,
  input: {
    lotId: string;
    viewerRole: UserRole;
    viewerStaffRoles?: StaffRoles | undefined;
    viewerId: string | undefined;
    limitQuery: string | undefined;
  },
): Promise<ListBidsForPublicApiResult> {
  const { lotId, viewerRole, viewerStaffRoles, viewerId, limitQuery } = input;
  const vStaff = viewerStaffRoles;
  const lot = await deps.lotRepo.findById(lotId);
  if (!lot) {
    return { kind: "not_found" };
  }
  if (lot.auctionType === "sealed" && lot.status === "active") {
    if (!roleHasCapability(viewerRole, "auction.manage", vStaff)) {
      return { kind: "ok", data: [] };
    }
  }
  const limit = clampLotBidsLimitQuery(limitQuery);
  const bids = await deps.bids.listForLot(lotId, limit);
  const canSeeBidderIds = roleHasCapability(viewerRole, "auction.manage", vStaff);
  const data: LotBidPublicApiRow[] = bids.map((bid) => {
    const isOwnBid = Boolean(viewerId && bid.placedByUserId === viewerId);
    const placedByUserIdForRef = bid.placedByUserId ?? "unknown";
    return {
      ...bid,
      bidderRef: lotBidderRef(lotId, placedByUserIdForRef),
      placedByUserId: canSeeBidderIds || isOwnBid ? (bid.placedByUserId ?? null) : null,
    };
  });
  return { kind: "ok", data };
}

/** Withdrawn lots keep their page but not their history. */
const HISTORY_HIDDEN_STATUSES: ReadonlySet<Lot["status"]> = new Set(["voided", "cancelled"]);

const EMPTY_PUBLIC_HISTORY: PublicBidHistory = { entries: [], total: 0 };

/**
 * The bids on a lot as the public sees them: amount, channel and time, newest first, with "you"
 * marked for the viewer and a total count. No bidder, paddle or account ever leaves here, and a
 * sealed lot shows nothing while it is open.
 */
export async function listPublicBidHistory(
  deps: LotServiceDeps,
  input: { lotId: string; viewerId: string | undefined; limitQuery: string | undefined },
): Promise<{ kind: "ok"; data: PublicBidHistory } | { kind: "not_found" }> {
  const lot = await deps.lotRepo.findById(input.lotId);
  if (!lot) return { kind: "not_found" };
  if (HISTORY_HIDDEN_STATUSES.has(lot.status)) return { kind: "ok", data: EMPTY_PUBLIC_HISTORY };
  if (lot.auctionType === "sealed" && lot.status === "active") {
    return { kind: "ok", data: EMPTY_PUBLIC_HISTORY };
  }
  const limit = clampLotBidsLimitQuery(input.limitQuery);
  const [bids, total] = await Promise.all([
    deps.bids.listForLot(input.lotId, limit),
    deps.bids.countForLot(input.lotId),
  ]);
  const rows = bids.map((bid) => ({
    amount: bid.amount,
    placedVia: bid.placedVia ?? null,
    createdAt: bid.createdAt,
    placedByViewer: Boolean(input.viewerId && bid.placedByUserId === input.viewerId),
  }));
  return { kind: "ok", data: toPublicBidHistory(rows, total) };
}

export async function countWatchersForPublicApi(
  deps: LotServiceDeps,
  lotId: string,
): Promise<{ kind: "ok"; count: number } | { kind: "not_found" }> {
  const lot = await deps.lotRepo.findById(lotId);
  if (!lot) {
    return { kind: "not_found" };
  }
  const count = await deps.watchlist.countForLot(lotId);
  return { kind: "ok", count };
}
