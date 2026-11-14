import "server-only";

import { fetchRegistryArtistById } from "@/lib/data/http/artist-profile-public";
import {
  getPublicLotBids,
  getPublicLotById,
  getPublicLotDocuments,
  getPublicLotList,
  getPublicLotWatchCount,
  getPublicSaleWithLots,
} from "@/lib/data/http/public-catalogue.server";
import { getServerSaleroomStatus } from "@/lib/data/http/saleroom-status.server";
import { getServerPublicUserReader } from "@/lib/data/http/users-public.reader";
import type { LotPageSecondaryData, LotPageShellData } from "@/lib/marketing/lot-page-data.service";

/*
 * The lot page's reads as everyone gets them (CO-7): no session, no cookies, each read tagged
 * with the lot or its sale so a change drops it. The personal half (watchlist, KYC, accounts,
 * registrations, the condition report request, telephone booking) is left empty here and comes
 * from `GET /api/lots/:id/me` in the browser.
 */

export const SIGNED_OUT_LOT_SECONDARY: Omit<LotPageSecondaryData, "initialSaleroomStatus"> = {
  actingCtx: { acting: null, memberships: [], impersonation: null, needsRestore: false },
  mySaleRegs: [],
  buyerConditionReportRequest: null,
  telephoneBookingForOnsite: null,
  orgModuleEnabled: false,
  bidAuthority: null,
};

export async function loadPublicLotShell(
  lotId: string,
  readLot: (id: string) => Promise<LotPageShellData["auction"] | null> = getPublicLotById,
): Promise<LotPageShellData | null> {
  const [auction, publicReader] = await Promise.all([readLot(lotId), getServerPublicUserReader()]);
  if (!auction) return null;

  const sellerLookupId = auction.sellerId ?? auction.sellerLegalEntityId ?? "";
  const [initialBids, seller, catalogArtist, relatedRaw, saleBundle, lotDocuments, watcherCount] =
    await Promise.all([
      getPublicLotBids(lotId, 30).catch(() => []),
      sellerLookupId
        ? publicReader.getById(sellerLookupId).catch(() => null)
        : Promise.resolve(null),
      auction.artistId
        ? fetchRegistryArtistById(auction.artistId).catch(() => null)
        : Promise.resolve(null),
      getPublicLotList({
        ...(sellerLookupId ? { sellerId: sellerLookupId } : {}),
        limit: 12,
        status: "active",
        sort: "endingAsc",
      }).catch(() => []),
      auction.saleId
        ? getPublicSaleWithLots(auction.saleId).catch(() => null)
        : Promise.resolve(null),
      getPublicLotDocuments(lotId).catch(() => []),
      getPublicLotWatchCount(lotId).catch(() => 0),
    ]);

  return {
    auction,
    session: null,
    initialBids,
    seller,
    catalogArtist,
    relatedRaw,
    watchlist: [],
    saleBundle,
    kycSummary: null,
    kycUnavailable: false,
    lotDocuments,
    watcherCount,
  };
}

/** Only the room's state, which is the same for everyone (and read again live in the browser). */
export async function loadPublicLotSecondary(
  shell: LotPageShellData,
): Promise<LotPageSecondaryData> {
  const isHybridSale = shell.saleBundle?.sale?.deliveryMode === "hybrid";
  const initialSaleroomStatus =
    isHybridSale && shell.auction.saleId
      ? await getServerSaleroomStatus(shell.auction.saleId)
      : { status: "none" as const, currentLotId: null };
  return { ...SIGNED_OUT_LOT_SECONDARY, initialSaleroomStatus };
}
