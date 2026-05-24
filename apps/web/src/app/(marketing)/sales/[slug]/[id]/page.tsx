import { ViewItemListTracker } from "@/components/analytics/view-item-list-tracker";
import { MarketingLoadMore } from "@/components/marketing/marketing-load-more";
import { SaleMobileSummaryBar } from "@/components/marketing/sale-mobile-summary-bar";
import { MarketingWatchlistHeart } from "@/components/marketing/watchlist-heart-button";
import {
  mapLotToCardVM,
  mapSaleToHeroVM,
  mapSaleToOverviewVM,
  mapSaleToRelatedVM,
} from "@/components/sections/saleroom/mappers";
import { SaleroomCatalogLotsByView } from "@/components/sections/saleroom/saleroom-catalog-lots-by-view";
import { SaleroomCatalogToolbarRow } from "@/components/sections/saleroom/saleroom-catalog-toolbar-row";
import { SaleroomHero } from "@/components/sections/saleroom/saleroom-hero";
import { SaleroomHeroActions } from "@/components/sections/saleroom/saleroom-hero-actions";
import { SaleroomHeroToolbar } from "@/components/sections/saleroom/saleroom-hero-toolbar";
import { SaleroomLotActions } from "@/components/sections/saleroom/saleroom-lot-actions";
import { SaleroomOverviewPanel } from "@/components/sections/saleroom/saleroom-overview-panel";
import { SaleroomRelatedAuctions } from "@/components/sections/saleroom/saleroom-related-auctions";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerKycStatusSummary } from "@/lib/data/http/kyc.server";
import { getServerRelatedSales, getServerSaleFollowState } from "@/lib/data/http/saleroom.server";
import {
  type SaleLotsPage,
  getServerSaleLotsPage,
  getServerSaleMyRegistrations,
  getServerSaleWithLots,
} from "@/lib/data/http/sales.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import { parseUrlLayoutView } from "@/lib/preferences/resolve-layout-view";
import { resolveMarketingLayoutView } from "@/lib/preferences/resolve-marketing-layout-view.server";
import { metadataForNotFound, metadataForSale } from "@/lib/seo/metadata-factory";
import {
  breadcrumbJsonLd,
  itemListJsonLd,
  jsonLdScript,
  saleEventJsonLd,
} from "@/lib/seo/structured-data";
import { salePath, slugify } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import type { Category, Sale } from "@auction/types";
import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";

export const revalidate = 0;

type PageProps = {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const CATALOG_PAGE_SIZE = 40;
const CATALOG_LOAD_ALL_CAP = 200;
const CATALOG_SORT = "lot" as const;

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
  const bundle = await getServerSaleWithLots(id).catch(() => null);
  if (!bundle) {
    return metadataForNotFound("Sale not found");
  }
  ensureCanonicalSaleSlug(slug, bundle.sale);
  return metadataForSale(bundle.sale);
}

async function loadCatalogLotsPage(id: string, pageRaw: string | undefined): Promise<SaleLotsPage> {
  const isAll = pageRaw === "all";
  if (isAll) {
    const first = await getServerSaleLotsPage({
      id,
      page: 1,
      pageSize: 1,
      sort: CATALOG_SORT,
    });
    if (!first) throw new Error("notfound");
    const cap = Math.min(CATALOG_LOAD_ALL_CAP, first.total);
    const full = await getServerSaleLotsPage({ id, page: 1, pageSize: cap, sort: CATALOG_SORT });
    if (!full) throw new Error("notfound");
    return full;
  }

  const pageNum = parsePage(pageRaw);
  const p = await getServerSaleLotsPage({
    id,
    page: pageNum,
    pageSize: CATALOG_PAGE_SIZE,
    sort: CATALOG_SORT,
  });
  if (!p) throw new Error("notfound");
  return p;
}

export default async function SaleDetailPage({ params, searchParams }: PageProps) {
  const { id, slug } = await params;
  const sp = await searchParams;

  const pageRaw = firstString(sp.page);
  const isCatalogLoadAll = pageRaw === "all";
  const pageNum = isCatalogLoadAll ? 1 : parsePage(pageRaw);

  const [bundle, session, categories] = await Promise.all([
    getServerSaleWithLots(id).catch(() => null),
    getServerSessionUser(),
    getServerCategoryReader()
      .then((r) => r.list())
      .catch((): Category[] => []),
  ]);
  if (!bundle) notFound();
  if (slug !== slugify(bundle.sale.title)) {
    permanentRedirect(canonicalSalePathWithQuery(bundle.sale, sp));
  }
  if (firstString(sp.tab) === "overview") {
    redirect(canonicalSalePathWithQuery(bundle.sale, sp));
  }

  const categoryId = bundle.sale.categoryId ?? null;
  const categoryLabel =
    categoryId && categories.length > 0
      ? (categories.find((c) => c.id === categoryId)?.name ?? null)
      : null;

  const lotsPage = await loadCatalogLotsPage(id, pageRaw).catch(() => null);
  if (!lotsPage) notFound();

  const [follow, relatedSales, kycSummary] = await Promise.all([
    session
      ? getServerSaleFollowState(id).catch(() => ({ isFollowing: false }))
      : Promise.resolve({ isFollowing: false }),
    getServerRelatedSales({ id, categoryId, limit: 4 }).catch(() => []),
    session ? getServerKycStatusSummary().catch(() => null) : Promise.resolve(null),
  ]);

  const actingCtx = session
    ? await resolveActingContext(session.role, session.staffRole ?? null)
    : null;
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

  const shownLots = isCatalogLoadAll
    ? Math.min(lotsPage.items.length, lotsPage.total)
    : Math.min(pageNum * CATALOG_PAGE_SIZE, lotsPage.total);

  const statusFilterRaw = firstString(sp.status);
  const statusFilter: "live" | "upcoming" | "ended" | null =
    statusFilterRaw === "live" || statusFilterRaw === "upcoming" || statusFilterRaw === "ended"
      ? statusFilterRaw
      : null;

  const preservedQuery: Array<[string, string]> = [["view", layoutView]];
  if (statusFilter) preservedQuery.push(["status", statusFilter]);

  const accumulatedLotIds = new Set<string>();
  const lotVMs = lotsPage.items
    .filter((lot) => {
      if (accumulatedLotIds.has(lot.id)) return false;
      accumulatedLotIds.add(lot.id);
      if (statusFilter === "live" && lot.status !== "active") return false;
      if (statusFilter === "upcoming" && lot.status !== "scheduled") return false;
      if (statusFilter === "ended" && lot.status !== "ended") return false;
      return true;
    })
    .map((lot) => mapLotToCardVM(lot, { viewerUserId, now, initialWatching: false }));

  const relatedVMs = relatedSales.map((r) => mapSaleToRelatedVM(r.sale, r.lotCount));

  const crumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Auctions", path: "/sales" },
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

  const isAuthenticated = Boolean(session);

  const buyerEntities =
    actingCtx?.memberships
      .filter((m) => m.status === "approved" || m.status === "restricted")
      .map((m) => ({
        id: m.id,
        displayName: m.displayName,
        memberRole: m.role,
      })) ?? [];

  const registerToBidShow =
    bundle.sale.deliveryMode === "online" &&
    (bundle.sale.status === "scheduled" || bundle.sale.status === "active") &&
    buyerEntities.some((e) => e.memberRole === "buyer_agent");

  const myRegistrations = mySaleRegs.map((r) => ({
    buyerLegalEntityId: r.buyerLegalEntityId,
    status: r.status,
  }));

  const kycApproved = session?.kycStatus === "approved";
  const kycFeedback = kycApproved ? null : (kycSummary?.feedback ?? null);

  const catalogEmptyMessage =
    statusFilter && lotVMs.length === 0
      ? `No ${statusFilter} lots match these filters.`
      : "No lots in this section yet.";

  const catalogClearFiltersHref =
    statusFilter != null
      ? (() => {
          const qs = new URLSearchParams();
          if (layoutView !== "grid") qs.set("view", layoutView);
          if (isCatalogLoadAll) qs.set("page", "all");
          else if (pageNum > 1) qs.set("page", String(pageNum));
          const q = qs.toString();
          return q ? `${basePath}?${q}` : basePath;
        })()
      : null;

  return (
    <main
      id="main-content"
      className="bg-page-bg pb-32 pt-(--section-pt-tight) dark:bg-background lg:pb-24"
    >
      <script type="application/ld+json" suppressHydrationWarning>
        {jsonLdText}
      </script>
      <SaleMobileSummaryBar
        start={bundle.sale.startTime}
        end={bundle.sale.endTime}
        status={bundle.sale.status}
        saleTitle={bundle.sale.title}
        {...(liveLotsCount > 0 ? { liveLotsCount } : {})}
      />

      <SaleroomHero
        hero={heroVM}
        isAuthenticated={isAuthenticated}
        toolbar={<SaleroomHeroToolbar shareUrl={shareUrl} shareTitle={bundle.sale.title} />}
        actions={
          <SaleroomHeroActions
            saleId={bundle.sale.id}
            saleHref={basePath}
            isAuthenticated={isAuthenticated}
            initialFollowing={bundle.viewer?.isFollowing ?? follow.isFollowing ?? false}
            registerToBid={{
              show: registerToBidShow,
              buyerEntities,
              myRegistrations,
              kycApproved,
              kycFeedback,
            }}
          />
        }
      />

      <section
        id="catalog"
        className="mx-auto max-w-[var(--container-max,1440px)] px-4 pb-0 pt-14 sm:px-6 md:px-8"
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
            statusFilter && lotVMs.length !== lotsPage.total
              ? `${lotVMs.length} matching · ${lotsPage.total} in sale`
              : `${lotsPage.total} lots`
          }
        />
        <SaleroomCatalogLotsByView
          view={layoutView}
          lots={lotVMs}
          emptyMessage={catalogEmptyMessage}
          clearFiltersHref={catalogClearFiltersHref}
          renderCorner={(lot) => (
            <MarketingWatchlistHeart
              lotId={lot.id}
              lotTitle={lot.title}
              initialWatching={lot.viewerIsWatching}
              isAuthenticated={isAuthenticated}
              loginNextPath={lot.href}
            />
          )}
          renderActions={(lot) => <SaleroomLotActions lotHref={lot.href} />}
        />
        <MarketingLoadMore
          shown={shownLots}
          total={lotsPage.total}
          page={pageNum}
          pageSize={CATALOG_PAGE_SIZE}
          basePath={basePath}
          preservedQuery={preservedQuery}
          showLoadAll={!isCatalogLoadAll && lotsPage.total <= CATALOG_LOAD_ALL_CAP}
          loadAllCap={CATALOG_LOAD_ALL_CAP}
        />
      </section>

      <section
        className="mx-auto max-w-[var(--container-max,1440px)] px-4 pb-0 pt-16 sm:px-6 md:px-8"
        aria-label="Additional sale information"
      >
        <SaleroomOverviewPanel overview={overviewVM} />
      </section>

      {relatedVMs.length > 0 ? (
        <section className="mx-auto mt-20 max-w-[var(--container-max,1440px)] px-4 sm:px-6 md:px-8">
          <SaleroomRelatedAuctions related={relatedVMs} />
        </section>
      ) : null}
    </main>
  );
}

export type { SaleLotsPage };
