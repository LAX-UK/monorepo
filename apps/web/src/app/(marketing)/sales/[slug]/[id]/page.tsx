import { ViewItemListTracker } from "@/components/analytics/view-item-list-tracker";
import { MarketingDetailShell } from "@/components/marketing/marketing-detail-shell";
import { MarketingDetailWayfinding } from "@/components/marketing/marketing-detail-wayfinding";
import { MarketingPaginationControls } from "@/components/marketing/marketing-pagination-controls";
import { SaleAnchorTabs } from "@/components/marketing/sale-anchor-tabs";
import { SaleMobileSummaryBar } from "@/components/marketing/sale-mobile-summary-bar";
import { SaleTelephoneBiddingSection } from "@/components/marketing/sale-telephone-bidding-section";
import {
  mapLotToCardVM,
  mapSaleToHeroVM,
  mapSaleToOverviewVM,
} from "@/components/sections/saleroom/mappers";
import { SaleroomCatalogLiveShell } from "@/components/sections/saleroom/saleroom-catalog-live-shell";
import { SaleroomCatalogLotsLive } from "@/components/sections/saleroom/saleroom-catalog-lots-live";
import { SaleroomCatalogToolbarRow } from "@/components/sections/saleroom/saleroom-catalog-toolbar-row";
import { SaleroomHero } from "@/components/sections/saleroom/saleroom-hero";
import { SaleroomHeroActionRow } from "@/components/sections/saleroom/saleroom-hero-action-row";
import { SaleroomHeroToolbar } from "@/components/sections/saleroom/saleroom-hero-toolbar";
import { SaleroomOverviewPanel } from "@/components/sections/saleroom/saleroom-overview-panel";
import { SaleroomRelatedAuctionsSection } from "@/components/sections/saleroom/saleroom-related-auctions-section";
import {
  isPublicCatalogSale,
  viewerCanSeeNonPublicCatalog,
} from "@/lib/catalog/public-catalog-visibility";
import { getServerSaleroomStatus } from "@/lib/data/http/saleroom-status.server";
import {
  type SaleLotsPage,
  getServerSaleMyRegistrations,
  getServerSaleShell,
} from "@/lib/data/http/sales.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import { saleroomLotLinkParams } from "@/lib/marketing/catalog-links";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { buildSaleAnchorTabs } from "@/lib/marketing/sale-anchor-tab-list";
import { parseSaleroomCatalogSort } from "@/lib/marketing/saleroom-catalog-sort";
import { saleroomPageDataService } from "@/lib/marketing/saleroom-page-data.service";
import { parseUrlLayoutView } from "@/lib/preferences/resolve-layout-view";
import { resolveMarketingLayoutView } from "@/lib/preferences/resolve-marketing-layout-view.server";
import { resolveViewerParticipation } from "@/lib/presenters/viewer-participation";
import { saleAllowsWebBidding } from "@/lib/sale-mode";
import { metadataForNotFound, metadataForSale } from "@/lib/seo/metadata-factory";
import {
  breadcrumbJsonLd,
  itemListJsonLd,
  jsonLdScript,
  saleEventJsonLd,
} from "@/lib/seo/structured-data";
import { salePath, slugify } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import type { Sale } from "@auction/types";
import { cn } from "@auction/ui";
import {
  formatPostalAddressLines,
  isSaleroomDeliveryMode,
  resolveOnsiteMapUrl,
} from "@auction/validators";
import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { Suspense } from "react";

export const revalidate = 60;

type PageProps = {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const CATALOG_PAGE_SIZE = 40;

function firstString(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return typeof v === "string" ? v : v[0];
}

function parsePage(raw: string | undefined): number {
  if (raw === "all") return 1;
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 500) : 1;
}

function canonicalSalePathWithQuery(sale: Sale, sp: Record<string, string | string[] | undefined>) {
  const qs = new URLSearchParams();
  const page = firstString(sp.page);
  if (page) qs.set("page", page);
  const view = parseUrlLayoutView(firstString(sp.view));
  if (view) qs.set("view", view);
  const q = qs.toString();
  const path = salePath(sale);
  return q ? `${path}?${q}` : path;
}

function ensureCanonicalSaleSlug(slug: string, sale: Sale) {
  if (slug !== slugify(sale.title)) permanentRedirect(salePath(sale));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id, slug } = await params;
  const shell = await getServerSaleShell(id).catch(() => null);
  if (!shell) {
    return metadataForNotFound("Sale not found");
  }
  ensureCanonicalSaleSlug(slug, shell.sale);
  return metadataForSale(shell.sale);
}

export default async function SaleDetailPage({ params, searchParams }: PageProps) {
  const { id, slug } = await params;
  const sp = await searchParams;

  const pageRaw = firstString(sp.page);
  const catalogSearch = (firstString(sp.q) ?? "").trim();
  const catalogSort = parseSaleroomCatalogSort(firstString(sp.sort));
  const statusFilterRaw = firstString(sp.status);
  const statusFilter: "live" | "upcoming" | "ended" | null =
    statusFilterRaw === "live" || statusFilterRaw === "upcoming" || statusFilterRaw === "ended"
      ? statusFilterRaw
      : null;
  /** Keyword search and status chips both filter client-side, so we load the whole
   * catalogue (up to the cap) to keep matching/counts correct across every page. */
  const isCatalogLoadAll = pageRaw === "all" || catalogSearch !== "" || statusFilter != null;
  const pageNum = isCatalogLoadAll ? 1 : parsePage(pageRaw);

  const [loaded, session] = await Promise.all([
    saleroomPageDataService.loadShell({
      saleId: id,
      page: pageNum,
      sort: catalogSort,
      loadAll: isCatalogLoadAll,
      pageSize: CATALOG_PAGE_SIZE,
    }),
    getServerSessionUser(),
  ]);
  if (!loaded) notFound();
  const { shell, lotsPage, categoryLabel } = loaded;
  const bundle = shell;
  const canPreviewCatalog = viewerCanSeeNonPublicCatalog(session?.role, session?.staffRole);
  if (!canPreviewCatalog && !isPublicCatalogSale(bundle.sale)) {
    notFound();
  }
  if (slug !== slugify(bundle.sale.title)) {
    permanentRedirect(canonicalSalePathWithQuery(bundle.sale, sp));
  }
  if (firstString(sp.tab) === "overview") {
    redirect(canonicalSalePathWithQuery(bundle.sale, sp));
  }

  const secondary = await saleroomPageDataService.loadSecondary(id, bundle.sale, session);
  const { follow, kycSummary, watchedLotIds, telephoneBooking } = secondary;

  const actingCtx = session
    ? await resolveActingContext(session.role, session.staffRole ?? null)
    : null;
  const orgModuleEnabled = await resolveOrgModuleEnabledFromRequest();
  const mySaleRegs = session ? await getServerSaleMyRegistrations(id).catch(() => []) : [];

  const layoutViewRaw = await resolveMarketingLayoutView({
    routeKey: "sales-lot",
    category: "lots",
    urlView: firstString(sp.view),
    user: session,
    fallback: "grid",
  });
  /** Saleroom catalogue supports grid + list only (`card` maps to grid). */
  const layoutView = layoutViewRaw === "card" ? "grid" : layoutViewRaw;

  const base = getSiteUrl();
  const viewerUserId = session?.id ?? null;
  const basePath = salePath(bundle.sale);
  const shareUrl = `${base}${basePath}`;

  const now = new Date();
  const liveLotsCount = lotsPage.items.filter((l) => l.status === "active").length;
  const heroVM = mapSaleToHeroVM(bundle.sale, {
    totalLots: lotsPage.total,
    shareUrl,
    now,
    categoryLabel,
    ...(liveLotsCount > 0 ? { liveLotsCount } : {}),
  });
  const overviewVM = mapSaleToOverviewVM(bundle.sale, {
    lotsTotal: lotsPage.total,
    categoryLabel,
  });

  const preservedQuery: Array<[string, string]> = [["view", layoutView]];
  if (statusFilter) preservedQuery.push(["status", statusFilter]);
  if (catalogSort !== "lot") preservedQuery.push(["sort", catalogSort]);

  const catalogTotalPages = Math.max(1, Math.ceil(lotsPage.total / CATALOG_PAGE_SIZE));
  const catalogPageHref = (page: number) => {
    const qs = new URLSearchParams(preservedQuery);
    if (page > 1) qs.set("page", String(page));
    const s = qs.toString();
    return `${basePath}${s ? `?${s}` : ""}#catalog`;
  };

  const lotLinkParams = saleroomLotLinkParams(layoutView, statusFilter);

  const searchNeedle = catalogSearch.toLowerCase();
  const accumulatedLotIds = new Set<string>();
  const lotVMs = lotsPage.items
    .filter((lot) => {
      if (accumulatedLotIds.has(lot.id)) return false;
      accumulatedLotIds.add(lot.id);
      if (statusFilter === "live" && lot.status !== "active") return false;
      if (statusFilter === "upcoming" && lot.status !== "scheduled") return false;
      if (statusFilter === "ended" && lot.status !== "ended") return false;
      if (searchNeedle && !lot.title.toLowerCase().includes(searchNeedle)) return false;
      return true;
    })
    .map((lot) =>
      mapLotToCardVM(lot, {
        viewerUserId,
        now,
        initialWatching: watchedLotIds.has(lot.id),
        catalogLinkParams: lotLinkParams,
      }),
    );

  const crumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Calendar", path: "/sales" },
    { name: bundle.sale.title, path: basePath },
  ]);

  const itemsLd =
    lotVMs.length > 0
      ? itemListJsonLd(
          lotVMs.map((lot) => ({
            name: lot.title,
            url: `${base}${lot.href}`,
          })),
        )
      : null;
  const eventLd = saleEventJsonLd(bundle.sale);
  const jsonLdText = jsonLdScript(...(itemsLd ? [crumbs, eventLd, itemsLd] : [crumbs, eventLd]));

  const viewer = resolveViewerParticipation(session);
  const isAuthenticated = viewer.isAuthenticated;
  const showTelephoneBooking =
    viewer.canParticipateAsBuyer &&
    isSaleroomDeliveryMode(bundle.sale.deliveryMode) &&
    (bundle.sale.status === "scheduled" || bundle.sale.status === "active");

  const buyerEntities =
    actingCtx?.memberships
      .filter((m) => m.status === "approved" || m.status === "restricted")
      .map((m) => ({
        id: m.id,
        displayName: m.displayName,
        memberRole: m.role,
      })) ?? [];

  const registerToBidShow =
    saleAllowsWebBidding(bundle.sale.deliveryMode) &&
    (bundle.sale.status === "scheduled" || bundle.sale.status === "active") &&
    viewer.canParticipateAsBuyer;

  const myRegistrations = mySaleRegs.map((r) => ({
    buyerLegalEntityId: r.buyerLegalEntityId,
    status: r.status,
    bidLimit: r.bidLimit,
  }));

  const kycApproved = session?.kycStatus === "approved";
  const kycFeedback = kycApproved ? null : (kycSummary?.feedback ?? null);

  const hasCatalogNarrowing = statusFilter != null || catalogSearch !== "";

  const catalogEmptyMessage =
    catalogSearch && lotVMs.length === 0
      ? `No lots match “${catalogSearch}”.`
      : statusFilter && lotVMs.length === 0
        ? `No ${statusFilter} lots match these filters.`
        : "No lots in this section yet.";

  const catalogClearFiltersHref = hasCatalogNarrowing
    ? (() => {
        const qs = new URLSearchParams();
        if (layoutView !== "grid") qs.set("view", layoutView);
        if (catalogSort !== "lot") qs.set("sort", catalogSort);
        if (!catalogSearch && isCatalogLoadAll) qs.set("page", "all");
        else if (!catalogSearch && pageNum > 1) qs.set("page", String(pageNum));
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
  const featuredLotTitles = lotVMs.slice(0, 3).map((lot) => lot.title);

  const isHybridSaleroom = bundle.sale.deliveryMode === "hybrid";
  const initialSaleroomStatus = isHybridSaleroom
    ? await getServerSaleroomStatus(bundle.sale.id)
    : { status: "none" as const, currentLotId: null };

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

  return (
    <SaleroomCatalogLiveShell
      saleId={isHybridSaleroom ? bundle.sale.id : null}
      initial={initialSaleroomStatus}
    >
      <MarketingDetailShell
        wrapChildren={false}
        jsonLd={
          <script type="application/ld+json" suppressHydrationWarning>
            {jsonLdText}
          </script>
        }
        leadingChrome={
          <SaleMobileSummaryBar
            start={bundle.sale.startTime}
            end={bundle.sale.endTime}
            status={bundle.sale.status}
            saleTitle={bundle.sale.title}
            deliveryMode={bundle.sale.deliveryMode}
            directionsUrl={directionsUrl}
            streamUrl={bundle.sale.streamUrl}
            sale={bundle.sale}
            locationLine={locationLine}
            canParticipate={viewer.canParticipateAsBuyer}
            {...(liveLotsCount > 0 ? { liveLotsCount } : {})}
            {...(isHybridSaleroom ? { saleroomLotRefs } : {})}
          />
        }
        wayfinding={
          <MarketingDetailWayfinding
            backHref={calendarBackHref}
            backLabel="Back to calendar"
            breadcrumbItems={[
              { label: "Home", href: "/" },
              { label: "Calendar", href: "/sales" },
              { label: bundle.sale.title, current: true },
            ]}
            className="pb-2"
          />
        }
        wayfindingClassName="hidden md:block"
        hero={
          <SaleroomHero
            hero={heroVM}
            backHref={calendarBackHref}
            deliveryMode={bundle.sale.deliveryMode}
            catalogLotRefs={catalogLotRefs}
            saleroomSession={isHybridSaleroom ? initialSaleroomStatus : null}
            toolbar={<SaleroomHeroToolbar shareUrl={shareUrl} shareTitle={bundle.sale.title} />}
            actions={
              <SaleroomHeroActionRow
                hero={heroVM}
                isAuthenticated={isAuthenticated}
                deliveryMode={bundle.sale.deliveryMode}
                streamUrl={bundle.sale.streamUrl}
                saleId={bundle.sale.id}
                saleHref={basePath}
                initialFollowing={bundle.viewer?.isFollowing ?? follow.isFollowing ?? false}
                sale={bundle.sale}
                registerToBid={{
                  show: registerToBidShow,
                  buyerEntities,
                  myRegistrations,
                  kycApproved,
                  kycFeedback,
                  orgModuleEnabled,
                  saleCurrency: "GBP",
                }}
              />
            }
          />
        }
      >
        <SaleAnchorTabs tabs={buildSaleAnchorTabs({ showTelephone: showTelephoneBooking })} />

        <section
          id="catalog"
          className={cn(
            MARKETING_PAGE_SHELL,
            "scroll-mt-[calc(var(--header-height)+3.5rem)] pb-0 pt-14",
          )}
        >
          <ViewItemListTracker
            listId={`sale:${bundle.sale.id}`}
            listName={bundle.sale.title}
            itemIds={lotVMs.map((l) => l.id)}
          />
          <SaleroomCatalogToolbarRow
            basePath={basePath}
            layoutView={layoutView}
            totalLots={lotsPage.total}
            countLabel={
              hasCatalogNarrowing && lotVMs.length !== lotsPage.total
                ? `${lotVMs.length} matching · ${lotsPage.total} in sale`
                : `${lotsPage.total} lots`
            }
            resultCountLabel={lotVMs.length === 1 ? "Show 1 lot" : `Show ${lotVMs.length} lots`}
          />
          <SaleroomCatalogLotsLive
            view={layoutView}
            lots={lotVMs}
            isAuthenticated={isAuthenticated}
            canParticipate={viewer.canParticipateAsBuyer}
            emptyMessage={catalogEmptyMessage}
            clearFiltersHref={catalogClearFiltersHref}
          />
          {isCatalogLoadAll ? null : (
            <MarketingPaginationControls
              ariaLabel="Catalogue pagination"
              currentPage={pageNum}
              totalPages={catalogTotalPages}
              getPageHref={catalogPageHref}
              className="mt-12 border-t border-border-hairline pt-10"
              scroll={false}
            />
          )}
        </section>

        {showTelephoneBooking ? (
          <SaleTelephoneBiddingSection
            saleId={bundle.sale.id}
            saleTitle={bundle.sale.title}
            loginNextPath={basePath}
            isAuthenticated={isAuthenticated}
            kycApproved={kycApproved}
            mobile={session?.mobile ?? null}
            {...(session?.mobileDisplay ? { mobileDisplay: session.mobileDisplay } : {})}
            buyerEntities={buyerEntities}
            existingBooking={telephoneBooking}
            orgModuleEnabled={orgModuleEnabled}
          />
        ) : null}

        <section
          id="overview"
          className={cn(
            MARKETING_PAGE_SHELL,
            "scroll-mt-[calc(var(--header-height)+3.5rem)] pb-0 pt-16",
          )}
          aria-label="Additional sale information"
        >
          <SaleroomOverviewPanel
            overview={overviewVM}
            sale={bundle.sale}
            featuredLotTitles={featuredLotTitles}
          />
        </section>

        <Suspense fallback={null}>
          <SaleroomRelatedAuctionsSection saleId={id} sale={bundle.sale} />
        </Suspense>
      </MarketingDetailShell>
    </SaleroomCatalogLiveShell>
  );
}

export type { SaleLotsPage };
