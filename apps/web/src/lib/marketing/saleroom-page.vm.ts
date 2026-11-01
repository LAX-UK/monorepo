import { splitBuyerMembershipsByState } from "@/lib/bid/buyer-entity-state";
import { resolveKycSurfaceFeedback } from "@/lib/bid/resolve-kyc-bid-gate";
import { atgCatalogState, atgDisplaySale } from "@/lib/catalog/atg-catalog-display";
import type { SessionUser } from "@/lib/data/contracts";
import type { KycUserFeedbackDto } from "@/lib/data/dto/dashboard-dtos";
import type {
  SaleLotsPage,
  SaleRegistrationMineRow,
  SaleShell,
} from "@/lib/data/http/sales.server";
import { saleroomLotLinkParams } from "@/lib/marketing/catalog-links";
import type { SaleroomSecondaryData } from "@/lib/marketing/saleroom-page-data.service";
import { SALE_CATALOG_LOAD_ALL_CAP } from "@/lib/marketing/saleroom-page-data.service";
import {
  SALEROOM_CATALOG_PAGE_SIZE,
  type SaleroomPageQuery,
} from "@/lib/marketing/saleroom-page.query";
import {
  type CatalogueControls,
  catalogueControls,
} from "@/lib/marketing/saleroom/catalogue-controls";
import {
  type CatalogueRow,
  mergeCatalogueRows,
  withdrawnRowsFor,
} from "@/lib/marketing/saleroom/catalogue-rows";
import {
  aggregateSaleEstimateTotal,
  mapLotToCardVM,
  mapSaleToDayGalleryVM,
  mapSaleToHeroVM,
  mapSaleToOverviewVM,
  mapSaleToPressCoverageVM,
} from "@/lib/marketing/saleroom/mappers";
import { type ResultsBandVM, buildResultsBand } from "@/lib/marketing/saleroom/results-band";
import {
  type CataloguePreparingVM,
  type SalePageState,
  cataloguePreparingCopy,
  resolveSalePageState,
} from "@/lib/marketing/saleroom/sale-page-state";
import type {
  DayGalleryVM,
  PressCoverageVM,
  SaleHeroVM,
  SaleLotCardVM,
  SaleOverviewVM,
} from "@/lib/marketing/saleroom/view-models";
import { organisationBidReasonCopy } from "@/lib/presenters/organisation-state/organisation-state-copy";
import { resolveViewerParticipation } from "@/lib/presenters/viewer-participation";
import { saleAllowsWebBidding } from "@/lib/sale-mode";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import { salePath } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import { roleBidsThroughAuthorisation } from "@auction/domain";
import type { LegalEntityMemberRole, LegalEntityStatus, Lot, Sale } from "@auction/types";
import {
  formatPostalAddressLines,
  isSaleroomDeliveryMode,
  resolveOnsiteMapUrl,
} from "@auction/validators";

export type SaleroomBuyerEntity = {
  id: string;
  displayName: string;
  memberRole: LegalEntityMemberRole;
};

/** An organisation whose state closes registration, with the words for why. */
export type SaleroomRegistrationPaused = { id: string; title: string; line: string };

export type SaleroomMyRegistration = Pick<
  SaleRegistrationMineRow,
  "buyerLegalEntityId" | "status" | "bidLimit" | "paddleNumber" | "checkedInAt"
>;

export type SaleroomDetailPageVM = {
  sale: Sale;
  shell: SaleShell;
  lotsPage: SaleLotsPage;
  query: SaleroomPageQuery;
  layoutView: "grid" | "list";
  basePath: string;
  shareUrl: string;
  now: Date;
  heroVM: SaleHeroVM;
  dayGalleryVM: DayGalleryVM | null;
  showDayGallery: boolean;
  pressCoverageItems: PressCoverageVM[] | null;
  showPressSection: boolean;
  overviewVM: SaleOverviewVM;
  lotVMs: SaleLotCardVM[];
  /** The catalogue in the order it is shown: lots, with withdrawn lots at their place. */
  catalogueRows: CatalogueRow<SaleLotCardVM>[];
  /** What the sale page is before its sections: the catalogue, or a promise of lots. */
  pageState: SalePageState;
  /** Which catalogue controls this sale's size earns. */
  controls: CatalogueControls;
  /** Server results of an ended sale, shown above the catalogue. */
  resultsBand: ResultsBandVM | null;
  /** Words for a scheduled sale whose lots are not online yet. */
  preparing: CataloguePreparingVM | null;
  /** Sale is selling on ATG: the page is a read-only catalogue that links out to bid. */
  atgReadOnly: boolean;
  /** Sale status for badges and timers; ATG-owned drafts read as upcoming, live or ended. */
  displayStatus: Sale["status"];
  /** Buyer actions on lax.bid; always false for ATG-owned sales. */
  canParticipate: boolean;
  liveLotsCount: number;
  catalogTotalPages: number;
  catalogPageHref: (page: number) => string;
  catalogEmptyMessage: string;
  catalogClearFiltersHref: string | null;
  catalogSearchFilterCapped: boolean;
  hasCatalogNarrowing: boolean;
  countLabel: string;
  resultCountLabel: string;
  calendarBackHref: string;
  locationLine: string;
  directionsUrl: string | null;
  isSaleroomSale: boolean;
  initialSaleroomStatus: PublicSaleroomSessionStatus;
  catalogLotRefs: Array<{ id: string; lotNumber: number | null; title: string }>;
  saleroomLotRefs: Array<{
    id: string;
    lotNumber: number | null;
    title: string;
    href: string;
    status: Lot["status"];
  }>;
  coverBlurDataURL: string | null;
  saleStartsSoon: boolean;
  showOnlineBiddingGatedBadge: boolean;
  viewer: ReturnType<typeof resolveViewerParticipation>;
  isAuthenticated: boolean;
  showTelephoneBooking: boolean;
  buyerEntities: SaleroomBuyerEntity[];
  /** Organisations the person registers for as a buyer agent whose state closes bidding, and why. */
  registrationPaused: SaleroomRegistrationPaused[];
  registerToBidShow: boolean;
  myRegistrations: SaleroomMyRegistration[];
  kycApproved: boolean;
  kycFeedback: KycUserFeedbackDto | null;
  orgModuleEnabled: boolean;
  relatedSales: SaleroomSecondaryData["relatedSales"];
  telephoneBooking: SaleroomSecondaryData["telephoneBooking"];
  initialFollowing: boolean;
  breadcrumbItems: Array<{ label: string; href?: string; current?: boolean }>;
};

export type BuildSaleroomPageVMInput = {
  shell: SaleShell;
  lotsPage: SaleLotsPage;
  filteredLots: Lot[];
  secondary: SaleroomSecondaryData;
  query: SaleroomPageQuery;
  layoutView: "grid" | "list";
  session: SessionUser | null;
  actingMemberships: ReadonlyArray<{
    id: string;
    displayName: string;
    role: LegalEntityMemberRole;
    status: LegalEntityStatus;
  }> | null;
  orgModuleEnabled: boolean;
  mySaleRegs: SaleRegistrationMineRow[];
  registeredBidderCount: number | null;
  initialSaleroomStatus: PublicSaleroomSessionStatus;
  categoryLabel: string | null;
  categoryLabels: string[];
  now?: Date;
};

export function buildSaleroomPageVM(input: BuildSaleroomPageVMInput): SaleroomDetailPageVM {
  const {
    shell,
    lotsPage,
    filteredLots,
    secondary,
    query,
    layoutView,
    session,
    actingMemberships,
    orgModuleEnabled,
    mySaleRegs,
    registeredBidderCount,
    initialSaleroomStatus,
    categoryLabel,
    categoryLabels,
  } = input;
  const now = input.now ?? new Date();
  const bundle = shell;
  const atgState = atgCatalogState(bundle.sale);
  /** Badges, timers and filters only; bidding and registration gates keep `bundle.sale`. */
  const displaySale = atgDisplaySale(bundle.sale, now);
  const base = getSiteUrl();
  const viewerUserId = session?.id ?? null;
  const basePath = salePath(bundle.sale);
  const shareUrl = `${base}${basePath}`;

  const liveLotsCount = lotsPage.items.filter((l) => l.status === "active").length;
  const allLotsLoaded = query.isCatalogLoadAll && lotsPage.items.length >= lotsPage.total;
  const estimatedTotalLabel = allLotsLoaded
    ? aggregateSaleEstimateTotal(lotsPage.items, {
        loadedCount: lotsPage.items.length,
        totalLots: lotsPage.total,
      })
    : null;
  const coverBlurDataURL = bundle.sale.coverImageAssets?.[0]?.blurDataURL ?? null;

  const heroVM = mapSaleToHeroVM(displaySale, {
    totalLots: lotsPage.total,
    shareUrl,
    now,
    ...(liveLotsCount > 0 ? { liveLotsCount } : {}),
    ...(estimatedTotalLabel ? { estimatedTotalLabel } : {}),
    ...(registeredBidderCount != null && registeredBidderCount > 0
      ? { registeredBidderCount }
      : {}),
  });
  const dayGalleryVM = mapSaleToDayGalleryVM(bundle.sale);
  const showDayGallery = dayGalleryVM !== null;
  const pressCoverageItems = mapSaleToPressCoverageVM(bundle.sale);
  const showPressSection = pressCoverageItems !== null && pressCoverageItems.length > 0;

  const overviewVM = mapSaleToOverviewVM(bundle.sale, {
    categoryLabel,
    categoryLabels,
  });

  const preservedQuery: Array<[string, string]> = [["view", layoutView]];
  if (query.statusFilter) preservedQuery.push(["status", query.statusFilter]);
  if (query.catalogSort !== "lot") preservedQuery.push(["sort", query.catalogSort]);

  const catalogTotalPages = Math.max(1, Math.ceil(lotsPage.total / SALEROOM_CATALOG_PAGE_SIZE));
  const catalogPageHref = (page: number) => {
    const qs = new URLSearchParams(preservedQuery);
    if (page > 1) qs.set("page", String(page));
    const s = qs.toString();
    return `${basePath}${s ? `?${s}` : ""}#catalog`;
  };

  const lotLinkParams = saleroomLotLinkParams(layoutView, query.statusFilter);
  const lotVMs = filteredLots.map((lot) =>
    mapLotToCardVM(lot, {
      viewerUserId,
      now,
      initialWatching: secondary.watchedLotIds.has(lot.id),
      catalogLinkParams: lotLinkParams,
      ...(atgState ? { atgState } : {}),
    }),
  );

  const withdrawnRows = withdrawnRowsFor(lotsPage.withdrawn, {
    statusFilter: query.statusFilter,
    catalogSearch: query.catalogSearch,
  });
  const catalogueRows = mergeCatalogueRows(lotVMs, withdrawnRows, query.catalogSort);
  const shownCount = catalogueRows.length;
  const pageState = resolveSalePageState({
    status: bundle.sale.status,
    lotCount: lotsPage.total,
  });
  const resultsBand = buildResultsBand(shell.resultsSummary, lotsPage.items);

  const viewer = resolveViewerParticipation(session);
  const isAuthenticated = viewer.isAuthenticated;
  const showTelephoneBooking =
    viewer.canParticipateAsBuyer &&
    isSaleroomDeliveryMode(bundle.sale.deliveryMode) &&
    (bundle.sale.status === "scheduled" || bundle.sale.status === "active");

  // The same state table as the server: an organisation whose state closes bidding is not
  // offered for registration, and a buyer agent of one is told why instead.
  const byState = splitBuyerMembershipsByState(actingMemberships ?? []);
  const buyerEntities = byState.open.map((m) => ({
    id: m.id,
    displayName: m.displayName,
    memberRole: m.role,
  }));
  const registrationPaused = byState.paused
    .filter((m) => roleBidsThroughAuthorisation(m.role))
    .map((m) => {
      const copy = organisationBidReasonCopy(m.reason, { organisationName: m.displayName });
      return { id: m.id, title: copy.title, line: copy.line };
    });

  const registerToBidShow =
    saleAllowsWebBidding(bundle.sale.deliveryMode) &&
    (bundle.sale.status === "scheduled" || bundle.sale.status === "active") &&
    viewer.canParticipateAsBuyer;

  const myRegistrations = mySaleRegs.map((r) => ({
    buyerLegalEntityId: r.buyerLegalEntityId,
    status: r.status,
    bidLimit: r.bidLimit,
    paddleNumber: r.paddleNumber,
    checkedInAt: r.checkedInAt,
  }));

  const kycApproved = session?.kycStatus === "approved";
  const kycFeedback = kycApproved
    ? null
    : resolveKycSurfaceFeedback({
        summary: secondary.kycSummary,
        unavailable: secondary.kycUnavailable,
      });

  const hasCatalogNarrowing = query.statusFilter != null || query.catalogSearch !== "";
  const catalogSearchFilterCapped =
    query.isCatalogLoadAll && lotsPage.total > SALE_CATALOG_LOAD_ALL_CAP;

  const catalogEmptyMessage =
    query.catalogSearch && shownCount === 0
      ? `No lots match “${query.catalogSearch}”.`
      : query.statusFilter && shownCount === 0
        ? `No ${query.statusFilter} lots match these filters.`
        : "No lots in this section yet.";

  const catalogClearFiltersHref = hasCatalogNarrowing
    ? (() => {
        const qs = new URLSearchParams();
        if (layoutView !== "grid") qs.set("view", layoutView);
        if (query.catalogSort !== "lot") qs.set("sort", query.catalogSort);
        if (!query.catalogSearch && query.isCatalogLoadAll) qs.set("page", "all");
        else if (!query.catalogSearch && query.pageNum > 1) qs.set("page", String(query.pageNum));
        const q = qs.toString();
        return q ? `${basePath}?${q}` : basePath;
      })()
    : null;

  const calendarBackHref = (() => {
    const qs = new URLSearchParams();
    if (layoutView !== "grid") qs.set("view", layoutView);
    const q = qs.toString();
    return q ? `/sales?${q}` : "/sales";
  })();

  const locationLine = [bundle.sale.locationName, ...formatPostalAddressLines(bundle.sale)]
    .filter(Boolean)
    .join(", ");
  const directionsUrl = resolveOnsiteMapUrl(bundle.sale);

  const isSaleroomSale = isSaleroomDeliveryMode(bundle.sale.deliveryMode);

  const catalogLotRefs = lotsPage.items.map((lot) => ({
    id: lot.id,
    lotNumber: lot.lotNumber,
    title: lot.title,
  }));

  const saleroomLotRefs = lotVMs.map((lot) => ({
    id: lot.id,
    lotNumber: lot.lotNumber ?? null,
    title: lot.title,
    href: lot.href,
    status: lot.status,
  }));

  const countLabel = catalogSearchFilterCapped
    ? hasCatalogNarrowing && shownCount !== lotsPage.items.length + lotsPage.withdrawn.length
      ? `${shownCount} matching · first ${SALE_CATALOG_LOAD_ALL_CAP} of ${lotsPage.total} lots`
      : `First ${SALE_CATALOG_LOAD_ALL_CAP} of ${lotsPage.total} lots`
    : hasCatalogNarrowing && shownCount !== lotsPage.total
      ? `${shownCount} matching · ${lotsPage.total} in sale`
      : `${lotsPage.total} lots`;

  return {
    sale: bundle.sale,
    shell: bundle,
    lotsPage,
    query,
    layoutView,
    basePath,
    shareUrl,
    now,
    heroVM,
    dayGalleryVM,
    showDayGallery,
    pressCoverageItems,
    showPressSection,
    overviewVM,
    lotVMs,
    catalogueRows,
    pageState,
    controls: catalogueControls(lotsPage.total),
    resultsBand,
    preparing: pageState === "preparing" ? cataloguePreparingCopy(bundle.sale, now) : null,
    atgReadOnly: atgState != null,
    displayStatus: displaySale.status,
    canParticipate: viewer.canParticipateAsBuyer && !atgState,
    liveLotsCount,
    catalogTotalPages,
    catalogPageHref,
    catalogEmptyMessage,
    catalogClearFiltersHref,
    catalogSearchFilterCapped,
    hasCatalogNarrowing,
    countLabel,
    resultCountLabel: shownCount === 1 ? "Show 1 lot" : `Show ${shownCount} lots`,
    calendarBackHref,
    locationLine,
    directionsUrl,
    isSaleroomSale,
    initialSaleroomStatus,
    catalogLotRefs,
    saleroomLotRefs,
    coverBlurDataURL,
    saleStartsSoon:
      bundle.sale.status === "scheduled" &&
      bundle.sale.startTime.getTime() > now.getTime() &&
      bundle.sale.startTime.getTime() <= now.getTime() + 7 * 24 * 60 * 60 * 1000,
    showOnlineBiddingGatedBadge:
      bundle.sale.deliveryMode === "hybrid" && !bundle.sale.allowOnlineBidsBeforeGoLive,
    viewer,
    isAuthenticated,
    showTelephoneBooking,
    buyerEntities,
    registrationPaused,
    registerToBidShow,
    myRegistrations,
    kycApproved,
    kycFeedback,
    orgModuleEnabled,
    relatedSales: secondary.relatedSales,
    telephoneBooking: secondary.telephoneBooking,
    initialFollowing: bundle.viewer?.isFollowing ?? secondary.follow.isFollowing ?? false,
    breadcrumbItems: [
      { label: "Home", href: "/" },
      { label: "Calendar", href: "/sales" },
      { label: bundle.sale.title, current: true },
    ],
  };
}
