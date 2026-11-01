import { lotViewItemPriceMinor } from "@/lib/analytics/lot-view-item-price";
import type { BidHistoryEntry } from "@/lib/bid/bid-history-entry";
import { shouldShowBidStickyMobileBar } from "@/lib/bid/bid-sticky-mobile-bar.logic";
import { type BiddingAccount, resolveBiddingAccount } from "@/lib/bid/bidding-account";
import { buildSaleRegistrationBidGate } from "@/lib/bid/build-sale-registration-bid-gate";
import { splitBuyerMembershipsByState } from "@/lib/bid/buyer-entity-state";
import { computeIsOwnLot } from "@/lib/bid/compute-is-own-lot";
import { mapBidToHistoryEntry } from "@/lib/bid/map-bid-to-history-entry";
import { resolveKycSurfaceFeedback } from "@/lib/bid/resolve-kyc-bid-gate";
import { buildLotConditionReportViewModel } from "@/lib/condition-report/build-lot-condition-report-vm";
import type { LotConditionReportViewModel } from "@/lib/condition-report/lot-condition-report-session-input";
import { classifyLotTimerState } from "@/lib/lot/classify-lot-timer-state";
import { classifyLotLifecycle } from "@/lib/lot/lot-lifecycle";
import {
  mapAuctionSessionHeaderVM,
  mapLotToHeroVM,
  mapLotToSummarySeed,
  mapSaleLotsToQueueVMs,
  mapSiblingsToRailVM,
} from "@/lib/marketing/artwork/artwork-view-models";
import { buildArtworkPageAccordionBlocks } from "@/lib/marketing/artwork/build-artwork-accordion-blocks";
import {
  catalogLotLinkParamsFromSearchParams,
  lotCatalogBackHref,
  lotCatalogBackLabel,
} from "@/lib/marketing/catalog-links";
import type { LotPageSecondaryData, LotPageShellData } from "@/lib/marketing/lot-page-data.service";
import { mapSaleToOverviewVM } from "@/lib/marketing/saleroom/mappers";
import { resolveViewerParticipation } from "@/lib/presenters/viewer-participation";
import { saleAllowsWebBidding } from "@/lib/sale-mode";
import { resolveSaleStreamContext } from "@/lib/sale-stream-policy";
import { isSaleroomSessionLive } from "@/lib/saleroom/public-session-status";
import { breadcrumbJsonLd, jsonLdScript, lotProductJsonLd } from "@/lib/seo/structured-data";
import { artistPath, lotPath, salePath } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import { entityRoleCan } from "@auction/domain";
import type { Lot, Sale } from "@auction/types";
import { toLotCardTimingVM } from "@auction/validators";

type SaleLifecyclePick =
  | (Pick<Sale, "status" | "deliveryMode"> & Partial<Pick<Sale, "allowOnlineBidsBeforeGoLive">>)
  | null;

type LifecycleLotPick = Pick<
  Lot,
  "id" | "status" | "startTime" | "endTime" | "winnerId" | "currentPrice"
> & { hasWinner?: boolean | undefined };

/** "b. 1961" for a living artist, "1920–1999" for one who has died; `null` without a birth year. */
function artistLifespan(birthYear: string | null, deathYear: string | null): string | null {
  if (!birthYear) return null;
  return deathYear ? `${birthYear}–${deathYear}` : `b. ${birthYear}`;
}

function deriveLeadingBidderId(bids: LotPageShellData["initialBids"]): string | null {
  const winning = bids.find((b) => b.isWinning);
  return winning?.bidderId ?? winning?.placedByUserId ?? null;
}

export type LotPageViewModel = {
  serverNow: number;
  auction: LotPageShellData["auction"];
  session: LotPageShellData["session"];
  saleBundle: LotPageShellData["saleBundle"];
  kycSummary: LotPageShellData["kycSummary"];
  kycUnavailable: boolean;
  watcherCount: LotPageShellData["watcherCount"];
  actingCtx: LotPageSecondaryData["actingCtx"];
  orgModuleEnabled: boolean;
  initialSaleroomStatus: LotPageSecondaryData["initialSaleroomStatus"];
  initialHistory: BidHistoryEntry[];
  initialLeadingBidderId: string | null;
  watching: boolean;
  watchedLotIds: string[];
  parentSale: { id: string; title: string; deliveryMode: Sale["deliveryMode"] } | null;
  catalogLinkParams: ReturnType<typeof catalogLotLinkParamsFromSearchParams>;
  catalogBackHref: string;
  catalogBackLabel: string;
  lotNavVM: ReturnType<typeof mapLotToHeroVM>;
  sellerName: string;
  shareUrl: string;
  summarySeed: ReturnType<typeof mapLotToSummarySeed>;
  marketingBlocks: ReturnType<typeof buildArtworkPageAccordionBlocks>;
  rail: ReturnType<typeof mapSiblingsToRailVM>;
  jsonLdText: string;
  isOnsiteSale: boolean;
  isHybridSale: boolean;
  lotStreamCtx: ReturnType<typeof resolveSaleStreamContext> | null;
  conditionReport: LotConditionReportViewModel;
  saleroomLotRefs: Array<{
    id: string;
    lotNumber: number | null;
    title: string;
    href: string;
    status: Lot["status"];
  }>;
  queueVMs: ReturnType<typeof mapSaleLotsToQueueVMs>;
  artistNameByLotId: Record<string, string>;
  assignedPaddle: number | null;
  sessionHeaderVM: ReturnType<typeof mapAuctionSessionHeaderVM>;
  saleLifecyclePick: SaleLifecyclePick;
  lifecycleLotPick: LifecycleLotPick;
  showPreviewRibbon: boolean;
  isSaleQueueLoading: boolean;
  lotTimerState: ReturnType<typeof classifyLotTimerState>;
  initialMarketingBidBarActive: boolean;
  onsiteOverviewVM: ReturnType<typeof mapSaleToOverviewVM> | null;
  saleRegistrationBidGate: ReturnType<typeof buildSaleRegistrationBidGate>;
  isOwnLot: boolean;
  actingLegalEntityId: string | null;
  biddingAccount: BiddingAccount | null;
  buyerEntitiesForOnsite: Array<{
    id: string;
    displayName: string;
    memberRole: string;
  }>;
  telephoneBookingForOnsite: LotPageSecondaryData["telephoneBookingForOnsite"];
  viewItemCurrency: string;
  viewItemPriceMinor: number | undefined;
  viewer: ReturnType<typeof resolveViewerParticipation>;
  kycApprovedForBid: boolean;
  saleLots: NonNullable<LotPageShellData["saleBundle"]>["lots"] | null;
  breadcrumbItems: Array<{ label: string; href?: string; current?: boolean }>;
  /** The registry artist the lot is attributed to, with their page; `null` when unattributed. */
  artist: { id: string; name: string; href: string; lifespan: string | null } | null;
  /** Published documents for the lot, as links. */
  lotDocuments: Array<{ label: string; href: string }>;
};

export function buildLotPageViewModel(input: {
  shell: LotPageShellData;
  secondary: LotPageSecondaryData;
  searchParams: Record<string, string | string[] | undefined>;
  serverNow: number;
}): LotPageViewModel {
  const { shell, secondary, searchParams: sp, serverNow } = input;
  const {
    auction,
    session,
    initialBids,
    seller,
    catalogArtist,
    relatedRaw,
    watchlist,
    saleBundle,
    kycSummary,
    kycUnavailable,
    lotDocuments,
    watcherCount,
  } = shell;
  const {
    actingCtx,
    mySaleRegs,
    buyerConditionReportRequest,
    telephoneBookingForOnsite,
    initialSaleroomStatus,
    orgModuleEnabled,
    bidAuthority,
  } = secondary;

  const artistForAccordion = catalogArtist
    ? {
        id: catalogArtist.id,
        name: catalogArtist.displayName,
        image: catalogArtist.portraitUrl ?? null,
      }
    : null;

  const initialHistory = initialBids.map(mapBidToHistoryEntry);
  const initialLeadingBidderId = deriveLeadingBidderId(initialBids);

  const watching = watchlist.some((w) => w.lotId === auction.id);
  const watchedLotIds = watchlist.map((w) => w.lotId);
  const parentSale = saleBundle
    ? {
        id: saleBundle.sale.id,
        title: saleBundle.sale.title,
        deliveryMode: saleBundle.sale.deliveryMode,
      }
    : null;
  const catalogLinkParams = catalogLotLinkParamsFromSearchParams(sp);
  const catalogBackHref = lotCatalogBackHref(sp, parentSale);
  const catalogBackLabel = lotCatalogBackLabel(sp, parentSale);
  const saleLots = saleBundle?.lots ?? null;
  const lotNavVM = mapLotToHeroVM(
    auction,
    parentSale ? { id: parentSale.id, title: parentSale.title } : null,
    saleLots,
    catalogLinkParams,
  );
  const sellerName = seller?.name ?? "Private seller";
  const shareUrl = `${getSiteUrl()}${lotPath(auction)}`;
  const sellerHref = catalogArtist
    ? artistPath({ id: catalogArtist.id, name: catalogArtist.displayName })
    : "";
  const summarySeed = mapLotToSummarySeed(auction, sellerName, sellerHref, seller?.image ?? null);
  const marketingBlocks = buildArtworkPageAccordionBlocks({
    lot: auction,
    artist: artistForAccordion,
    documents: lotDocuments,
  });
  const rail = mapSiblingsToRailVM(
    auction,
    parentSale,
    saleLots,
    relatedRaw,
    (l) => (l.sellerId === auction.sellerId ? sellerName : "Seller"),
    catalogLinkParams,
  );

  const crumbs = breadcrumbJsonLd(
    parentSale
      ? [
          { name: "Home", path: "/" },
          { name: parentSale.title, path: salePath(parentSale) },
          { name: auction.title, path: lotPath(auction) },
        ]
      : [
          { name: "Home", path: "/" },
          { name: "Search", path: "/search" },
          { name: auction.title, path: lotPath(auction) },
        ],
  );
  const jsonLdText = jsonLdScript(
    lotProductJsonLd(auction, {
      ...(artistForAccordion?.name ? { artistName: artistForAccordion.name } : {}),
      ...(sellerName ? { sellerName } : {}),
    }),
    crumbs,
  );

  const isOnsiteSale =
    saleBundle?.sale != null && !saleAllowsWebBidding(saleBundle.sale.deliveryMode);
  const isHybridSale = saleBundle?.sale?.deliveryMode === "hybrid";
  const lotStreamCtx = saleBundle?.sale
    ? resolveSaleStreamContext({
        streamUrl: saleBundle.sale.streamUrl,
        status: saleBundle.sale.status,
        deliveryMode: saleBundle.sale.deliveryMode,
        saleTitle: saleBundle.sale.title,
        endTime: saleBundle.sale.endTime,
      })
    : null;

  const mdCr = auction.marketingDetails?.conditionReport;
  const publishedConditionReport =
    mdCr?.downloadUrl || mdCr?.summary
      ? {
          ...(mdCr.summary ? { summary: mdCr.summary } : {}),
          ...(mdCr.downloadUrl ? { downloadUrl: mdCr.downloadUrl } : {}),
        }
      : null;

  const saleroomLotRefs = isHybridSale
    ? (saleLots ?? []).map((l) => ({
        id: l.id,
        lotNumber: l.lotNumber,
        title: l.title,
        href: lotPath(l),
        status: l.status,
      }))
    : [];

  const queueVMs = mapSaleLotsToQueueVMs(
    auction,
    saleLots,
    (l) => (l.sellerId === auction.sellerId ? sellerName : "Seller"),
    catalogLinkParams,
  );

  const artistNameByLotId = Object.fromEntries(
    (saleLots ?? []).map((l) => [l.id, l.sellerId === auction.sellerId ? sellerName : "Seller"]),
  );

  const assignedPaddle =
    mySaleRegs.find((reg) => reg.status === "approved" && reg.paddleNumber != null)?.paddleNumber ??
    null;

  const sessionHeaderVM = mapAuctionSessionHeaderVM({
    saleTitle: parentSale?.title ?? "Auction",
    lot: auction,
    userVerified: session?.emailVerified ?? false,
    paddleNumber: assignedPaddle != null ? String(assignedPaddle) : null,
  });

  const saleLifecyclePick = saleBundle?.sale
    ? {
        status: saleBundle.sale.status,
        deliveryMode: saleBundle.sale.deliveryMode,
        allowOnlineBidsBeforeGoLive: saleBundle.sale.allowOnlineBidsBeforeGoLive,
      }
    : null;

  const lifecycleLotPick = {
    id: auction.id,
    status: auction.status,
    startTime: auction.startTime,
    endTime: auction.endTime,
    winnerId: auction.winnerId,
    currentPrice: auction.currentPrice,
    ...("hasWinner" in auction && auction.hasWinner !== undefined
      ? { hasWinner: auction.hasWinner }
      : {}),
  };

  // Seed the SSR lifecycle with the server-loaded saleroom session so a hybrid
  // lot that is live on the block (even past the catalog end time) renders as
  // "live in saleroom" on first paint instead of flashing "no sale" before the
  // client SaleroomLiveProvider hydrates.
  const previewLife = classifyLotLifecycle(lifecycleLotPick, saleLifecyclePick, serverNow, {
    saleroomSessionActive: isSaleroomSessionLive(initialSaleroomStatus.status),
    saleroomSessionPaused: initialSaleroomStatus.status === "paused",
    isOnBlock: initialSaleroomStatus.currentLotId === auction.id,
  });
  const showPreviewRibbon = previewLife.kind === "preLaunch";
  const isSaleQueueLoading = Boolean(auction.saleId && saleBundle === null);
  const lotTimerState = classifyLotTimerState(toLotCardTimingVM(lifecycleLotPick), serverNow);
  const biddingLiveAtSsr =
    previewLife.kind === "live" ||
    previewLife.kind === "extended" ||
    previewLife.kind === "liveSaleroom" ||
    previewLife.kind === "saleroomPaused";
  const initialMarketingBidBarActive = shouldShowBidStickyMobileBar({
    live: biddingLiveAtSsr,
    lifecycleKind: previewLife.kind,
    timerState: lotTimerState,
  });

  const onsiteOverviewVM = saleBundle
    ? mapSaleToOverviewVM(saleBundle.sale, {
        categoryLabel: null,
      })
    : null;

  const kycApprovedForBid = session?.kycStatus === "approved";
  const viewer = resolveViewerParticipation(session);
  const kycFeedbackForBid = kycApprovedForBid
    ? null
    : resolveKycSurfaceFeedback({ summary: kycSummary, unavailable: kycUnavailable });
  const conditionReport = buildLotConditionReportViewModel({
    auction,
    session,
    saleDeliveryMode: saleBundle?.sale?.deliveryMode,
    auctionStatus: auction.status,
    kycSummary,
    kycUnavailable,
    kycFeedbackDto: kycFeedbackForBid,
    loginNextPath: lotPath(auction),
    canParticipate: viewer.canParticipateAsBuyer,
    publishedConditionReport,
    buyerConditionReportRequest,
  });
  const saleRegistrationBidGate = buildSaleRegistrationBidGate({
    saleId: auction.saleId,
    saleDeliveryMode: saleBundle?.sale?.deliveryMode,
    saleStatus: saleBundle?.sale?.status,
    acting: actingCtx.acting,
    memberships: [...actingCtx.memberships],
    myRegistrations: mySaleRegs.map((r) => ({
      buyerLegalEntityId: r.buyerLegalEntityId,
      status: r.status,
      bidLimit: r.bidLimit,
    })),
    kycApproved: kycApprovedForBid,
    kycFeedback: kycFeedbackForBid,
  });

  const isOwnLot = computeIsOwnLot(auction, session, actingCtx.acting);
  const actingLegalEntityId = actingCtx.acting?.id ?? null;
  const biddingAccount = session
    ? resolveBiddingAccount({
        acting: actingCtx.acting,
        memberships: actingCtx.memberships,
        authority: bidAuthority,
      })
    : null;

  // Accounts the person can bid for in the room: a bidding role, and a state that allows it.
  const buyerEntitiesForOnsite =
    splitBuyerMembershipsByState(actingCtx.memberships)
      .open.filter((membership) => entityRoleCan(membership.role, "entity.bid.place"))
      .map((membership) => ({
        id: membership.id,
        displayName: membership.displayName,
        memberRole: membership.role,
      })) ?? [];

  const viewItemCurrency = auction.marketingDetails?.estimate?.currency ?? "GBP";
  const viewItemPriceMinor = lotViewItemPriceMinor(auction);

  const breadcrumbItems = parentSale
    ? [
        { label: "Home", href: "/" },
        { label: parentSale.title, href: salePath(parentSale) },
        { label: auction.title, current: true },
      ]
    : [
        { label: "Home", href: "/" },
        { label: "Search", href: "/search" },
        { label: auction.title, current: true },
      ];

  const artist = catalogArtist
    ? {
        id: catalogArtist.id,
        name: catalogArtist.displayName,
        href: artistPath({ id: catalogArtist.id, name: catalogArtist.displayName }),
        lifespan: artistLifespan(catalogArtist.birthYear, catalogArtist.deathYear),
      }
    : null;
  const documentLinks = lotDocuments.map((d) => ({
    label: d.label?.trim() || d.kind.replaceAll("_", " "),
    href: d.downloadUrl,
  }));

  return {
    artist,
    lotDocuments: documentLinks,
    serverNow,
    auction,
    session,
    saleBundle,
    kycSummary,
    kycUnavailable,
    watcherCount,
    actingCtx,
    orgModuleEnabled,
    initialSaleroomStatus,
    initialHistory,
    initialLeadingBidderId,
    watching,
    watchedLotIds,
    parentSale,
    catalogLinkParams,
    catalogBackHref,
    catalogBackLabel,
    lotNavVM,
    sellerName,
    shareUrl,
    summarySeed,
    marketingBlocks,
    rail,
    jsonLdText,
    isOnsiteSale,
    isHybridSale,
    lotStreamCtx,
    conditionReport,
    saleroomLotRefs,
    queueVMs,
    artistNameByLotId,
    assignedPaddle,
    sessionHeaderVM,
    saleLifecyclePick,
    lifecycleLotPick,
    showPreviewRibbon,
    isSaleQueueLoading,
    lotTimerState,
    initialMarketingBidBarActive,
    onsiteOverviewVM,
    saleRegistrationBidGate,
    isOwnLot,
    actingLegalEntityId,
    biddingAccount,
    buyerEntitiesForOnsite,
    telephoneBookingForOnsite,
    viewItemCurrency,
    viewItemPriceMinor,
    viewer,
    kycApprovedForBid,
    saleLots,
    breadcrumbItems,
  };
}
