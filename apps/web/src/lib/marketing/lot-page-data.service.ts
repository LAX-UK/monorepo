import "server-only";

import { isSessionLookupTransientError } from "@/lib/auth/session-lookup-error";
import { getServerDataContainer } from "@/lib/data/container.server";
import type { PublicUser, SessionUser } from "@/lib/data/contracts";
import { fetchRegistryArtistById } from "@/lib/data/http/artist.server";
import { getServerAutoBid } from "@/lib/data/http/auto-bid.server";
import { getServerConditionReportForLot } from "@/lib/data/http/condition-report.server";
import { getServerKycStatusSummary } from "@/lib/data/http/kyc.server";
import {
  getServerLotBids,
  getServerLotById,
  getServerLotDocuments,
  getServerLotReader,
  getServerLotWatchCount,
} from "@/lib/data/http/lots.server";
import { getServerSaleroomStatus } from "@/lib/data/http/saleroom-status.server";
import { getServerSaleMyRegistrations, getServerSaleWithLots } from "@/lib/data/http/sales.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getServerTelephoneBookingForSale } from "@/lib/data/http/telephone-booking.server";
import { getServerPublicUserReader } from "@/lib/data/http/users-public.server";
import { isKycStatusUnavailableError } from "@/lib/kyc/kyc-status-unavailable-error";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import { saleAllowsWebBidding } from "@/lib/sale-mode";
import type { Bid, Lot } from "@auction/types";

const EMPTY_ACTING_CTX = {
  acting: null,
  memberships: [],
  impersonation: null,
  bootstrapFailed: false,
} as const;

export type LotPageShellData = {
  auction: NonNullable<Awaited<ReturnType<typeof getServerLotById>>>;
  session: SessionUser | null;
  initialBids: Bid[];
  seller: PublicUser | null;
  catalogArtist: Awaited<ReturnType<typeof fetchRegistryArtistById>> | null;
  relatedRaw: Lot[];
  watchlist: Awaited<
    ReturnType<Awaited<ReturnType<typeof getServerDataContainer>>["watchlist"]["listMine"]>
  >;
  saleBundle: Awaited<ReturnType<typeof getServerSaleWithLots>> | null;
  kycSummary: Awaited<ReturnType<typeof getServerKycStatusSummary>> | null;
  kycUnavailable: boolean;
  lotDocuments: Awaited<ReturnType<typeof getServerLotDocuments>>;
  initialAutoBidSettings: Awaited<ReturnType<typeof getServerAutoBid>> | null;
  watcherCount: number;
};

export type LotPageSecondaryData = {
  actingCtx: Awaited<ReturnType<typeof resolveActingContext>> | typeof EMPTY_ACTING_CTX;
  mySaleRegs: Awaited<ReturnType<typeof getServerSaleMyRegistrations>>;
  buyerConditionReportRequest: Awaited<ReturnType<typeof getServerConditionReportForLot>> | null;
  telephoneBookingForOnsite: Awaited<ReturnType<typeof getServerTelephoneBookingForSale>> | null;
  initialSaleroomStatus:
    | Awaited<ReturnType<typeof getServerSaleroomStatus>>
    | {
        status: "none";
        currentLotId: null;
      };
  orgModuleEnabled: boolean;
};

export class LotPageDataService {
  async loadShell(lotId: string): Promise<LotPageShellData | null> {
    const reader = await getServerLotReader();
    const [auction, session, publicReader] = await Promise.all([
      getServerLotById(lotId),
      loadPublicPageSession(),
      getServerPublicUserReader(),
    ]);
    if (!auction) return null;

    const watchlistPromise = session
      ? getServerDataContainer()
          .then((c) => c.watchlist.listMine())
          .catch(() => [])
      : Promise.resolve([]);

    const kycLookupPromise = session
      ? loadKycSummary()
      : Promise.resolve({ summary: null, unavailable: false });

    const initialAutoBidPromise = session
      ? getServerAutoBid(lotId).catch(() => null)
      : Promise.resolve(null);

    const sellerLookupId = auction.sellerId ?? auction.sellerLegalEntityId ?? "";
    const [
      initialBids,
      seller,
      catalogArtist,
      relatedRaw,
      watchlist,
      saleBundle,
      kycLookup,
      lotDocuments,
      initialAutoBidSettings,
      watcherCount,
    ] = await Promise.all([
      getServerLotBids(lotId, 30).catch(() => []),
      sellerLookupId
        ? publicReader.getById(sellerLookupId).catch(() => null)
        : Promise.resolve(null),
      auction.artistId
        ? fetchRegistryArtistById(auction.artistId).catch(() => null)
        : Promise.resolve(null),
      reader
        .list({
          ...(sellerLookupId ? { sellerId: sellerLookupId } : {}),
          limit: 12,
          status: "active",
          sort: "endingAsc",
        })
        .catch(() => []),
      watchlistPromise,
      auction.saleId
        ? getServerSaleWithLots(auction.saleId).catch(() => null)
        : Promise.resolve(null),
      kycLookupPromise,
      getServerLotDocuments(lotId).catch(() => []),
      initialAutoBidPromise,
      getServerLotWatchCount(lotId).catch(() => 0),
    ]);

    return {
      auction,
      session,
      initialBids,
      seller,
      catalogArtist,
      relatedRaw,
      watchlist,
      saleBundle,
      kycSummary: kycLookup.summary,
      kycUnavailable: kycLookup.unavailable,
      lotDocuments,
      initialAutoBidSettings,
      watcherCount,
    };
  }

  async loadSecondary(shell: LotPageShellData): Promise<LotPageSecondaryData> {
    const { auction, session, saleBundle } = shell;
    const isOnsiteSale =
      saleBundle?.sale != null && !saleAllowsWebBidding(saleBundle.sale.deliveryMode);
    const isHybridSale = saleBundle?.sale?.deliveryMode === "hybrid";

    const [actingCtx, mySaleRegs, buyerConditionReportRequest, orgModuleEnabled] =
      await Promise.all([
        session
          ? resolveActingContext(session.role, session.staffRole ?? null).catch(
              () => EMPTY_ACTING_CTX,
            )
          : Promise.resolve(EMPTY_ACTING_CTX),
        session && auction.saleId && saleBundle
          ? getServerSaleMyRegistrations(auction.saleId).catch(() => [])
          : Promise.resolve([]),
        session
          ? getServerConditionReportForLot(auction.id).catch(() => null)
          : Promise.resolve(null),
        resolveOrgModuleEnabledFromRequest(),
      ]);

    const telephoneBookingForOnsite =
      session && isOnsiteSale && auction.saleId
        ? await getServerTelephoneBookingForSale(auction.saleId).catch(() => null)
        : null;

    const initialSaleroomStatus =
      isHybridSale && auction.saleId
        ? await getServerSaleroomStatus(auction.saleId)
        : { status: "none" as const, currentLotId: null };

    return {
      actingCtx,
      mySaleRegs,
      buyerConditionReportRequest,
      telephoneBookingForOnsite,
      initialSaleroomStatus,
      orgModuleEnabled,
    };
  }
}

async function loadPublicPageSession(): Promise<SessionUser | null> {
  try {
    return await getServerSessionUser();
  } catch (error) {
    if (isSessionLookupTransientError(error)) return null;
    throw error;
  }
}

async function loadKycSummary(): Promise<{
  summary: Awaited<ReturnType<typeof getServerKycStatusSummary>>;
  unavailable: boolean;
}> {
  try {
    return { summary: await getServerKycStatusSummary(), unavailable: false };
  } catch (error) {
    if (isKycStatusUnavailableError(error)) return { summary: null, unavailable: true };
    throw error;
  }
}
