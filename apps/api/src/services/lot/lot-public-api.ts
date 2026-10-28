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
