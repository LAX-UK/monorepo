import { SaleMobileSummaryBar } from "@/components/marketing/sale-mobile-summary-bar";
import {
  mapLotToCardVM,
  mapSaleToHeroVM,
  mapSaleToOverviewVM,
  mapSaleToRelatedVM,
} from "@/components/sections/saleroom/mappers";
import { SaleroomHero } from "@/components/sections/saleroom/saleroom-hero";
import { SaleroomHeroActions } from "@/components/sections/saleroom/saleroom-hero-actions";
import { SaleroomHeroHeadline } from "@/components/sections/saleroom/saleroom-hero-headline";
import { SaleroomHeroStatusLines } from "@/components/sections/saleroom/saleroom-hero-meta";
import { SaleroomHeroToolbar } from "@/components/sections/saleroom/saleroom-hero-toolbar";
import { SaleroomLotActions } from "@/components/sections/saleroom/saleroom-lot-actions";
import { SaleroomLotsGrid } from "@/components/sections/saleroom/saleroom-lots-grid";
import { SaleroomOverviewPanel } from "@/components/sections/saleroom/saleroom-overview-panel";
import { SaleroomPaginator } from "@/components/sections/saleroom/saleroom-paginator";
import { SaleroomRelatedAuctions } from "@/components/sections/saleroom/saleroom-related-auctions";
import {
  SaleroomTabs,
  type TabDescriptor,
  type TabKey,
} from "@/components/sections/saleroom/saleroom-tabs";
import { SITE_TAGLINE } from "@/lib/brand";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerRelatedSales, getServerSaleFollowState } from "@/lib/data/http/saleroom.server";
import {
  type SaleLotsPage,
  getServerSaleLotsPage,
  getServerSaleWithLots,
} from "@/lib/data/http/sales.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { metadataForSale, metadataForStatic } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { getSiteUrl } from "@/lib/site-url";
import type { Category } from "@auction/types";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const revalidate = 0;

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const CATALOG_PAGE_SIZE = 12;
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

function parseTab(raw: string | undefined): TabKey {
  if (raw === "catalog") return "catalog";
  return "overview";
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const bundle = await getServerSaleWithLots(id).catch(() => null);
  if (!bundle) {
    return metadataForStatic({
      title: "Sale",
      description: SITE_TAGLINE,
      path: `/sales/${id}`,
    });
  }
  const { sale } = bundle;
  return metadataForSale({
    id: sale.id,
    title: sale.title,
    description: sale.description,
  });
}

async function loadCatalogLotsPage(
  id: string,
  tab: TabKey,
  pageRaw: string | undefined,
): Promise<SaleLotsPage> {
  const isAll = pageRaw === "all" && tab === "catalog";
  const pageNum = isAll ? 1 : parsePage(pageRaw);

  if (isAll) {
    const p = await getServerSaleLotsPage({
      id,
      page: 1,
      pageSize: CATALOG_PAGE_SIZE,
      sort: CATALOG_SORT,
    });
    if (!p) throw new Error("notfound");
    const cap = Math.min(48, p.total);
    if (cap > p.items.length) {
      const full = await getServerSaleLotsPage({ id, page: 1, pageSize: cap, sort: CATALOG_SORT });
      if (!full) throw new Error("notfound");
      return full;
    }
    return p;
  }

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
  const { id } = await params;
  const sp = await searchParams;
  const tab = parseTab(firstString(sp.tab));
  const pageRaw = firstString(sp.page);
  const isCatalogLoadAll = pageRaw === "all" && tab === "catalog";
  const pageNum = isCatalogLoadAll ? 1 : parsePage(pageRaw);

  const [bundle, session, categories] = await Promise.all([
    getServerSaleWithLots(id).catch(() => null),
    getServerSessionUser(),
    getServerCategoryReader()
      .then((r) => r.list())
      .catch((): Category[] => []),
  ]);
  if (!bundle) notFound();

  const categoryId = bundle.sale.categoryId ?? null;
  const categoryLabel =
    categoryId && categories.length > 0
      ? (categories.find((c) => c.id === categoryId)?.name ?? null)
      : null;

  const lotsPage =
    tab === "catalog"
      ? await loadCatalogLotsPage(id, tab, pageRaw).catch(() => null)
      : await getServerSaleLotsPage({
          id,
          page: 1,
          pageSize: CATALOG_PAGE_SIZE,
          sort: CATALOG_SORT,
        }).catch(() => null);
  if (!lotsPage) notFound();

  const [follow, relatedSales] = await Promise.all([
    session
      ? getServerSaleFollowState(id).catch(() => ({ isFollowing: false }))
      : Promise.resolve({ isFollowing: false }),
    getServerRelatedSales({ id, categoryId, limit: 4 }).catch(() => []),
  ]);

  const base = getSiteUrl();
  const viewerUserId = session?.id ?? null;
  const shareUrl = `${base}/sales/${bundle.sale.id}`;
  const basePath = `/sales/${bundle.sale.id}`;
  const preservedQuery: Array<[string, string]> = [["tab", tab]];

  const now = new Date();
  const heroVM = mapSaleToHeroVM(bundle.sale, {
    totalLots: lotsPage.total,
    shareUrl,
    now,
  });
  const overviewVM = mapSaleToOverviewVM(bundle.sale, {
    lotsTotal: lotsPage.total,
    categoryLabel,
  });

  const tabs: TabDescriptor[] = [
    { key: "overview", label: "Overview" },
    { key: "catalog", label: "Browse Lots", count: lotsPage.total },
  ];

  const shownLots = isCatalogLoadAll
    ? Math.min(lotsPage.items.length, lotsPage.total)
    : Math.min(pageNum * CATALOG_PAGE_SIZE, lotsPage.total);

  const accumulatedLotIds = new Set<string>();
  const lotVMs = lotsPage.items
    .filter((lot) => {
      if (accumulatedLotIds.has(lot.id)) return false;
      accumulatedLotIds.add(lot.id);
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
    tab === "catalog" && lotVMs.length > 0
      ? itemListJsonLd(
          lotVMs.map((lot) => ({
            name: lot.title,
            url: `${base}${lot.href}`,
          })),
        )
      : null;
  const jsonLdText = jsonLdScript(...(itemsLd ? [crumbs, itemsLd] : [crumbs]));

  const isAuthenticated = Boolean(session);
  const showRegisterCta = !isAuthenticated || heroVM.status === "scheduled";
  const registerHref = isAuthenticated
    ? `${basePath}#catalog`
    : `/login?next=${encodeURIComponent(basePath)}`;

  return (
    <main
      id="main-content"
      className="bg-page-bg pb-32 pt-[var(--section-pt-tight)] dark:bg-background lg:pb-24"
    >
      <script type="application/ld+json" suppressHydrationWarning>
        {jsonLdText}
      </script>
      <SaleMobileSummaryBar
        end={bundle.sale.endTime}
        saleTitle={bundle.sale.title}
        showRegisterCta={!isAuthenticated}
      />

      <SaleroomHero
        hero={heroVM}
        headline={<SaleroomHeroHeadline hero={heroVM} />}
        statusLines={<SaleroomHeroStatusLines hero={heroVM} />}
        toolbar={<SaleroomHeroToolbar shareUrl={shareUrl} shareTitle={bundle.sale.title} />}
        actions={
          <SaleroomHeroActions
            saleId={bundle.sale.id}
            isAuthenticated={isAuthenticated}
            initialFollowing={bundle.viewer?.isFollowing ?? follow.isFollowing ?? false}
            registerHref={registerHref}
            showRegisterCta={showRegisterCta}
          />
        }
      />

      <section id="catalog" className="mx-auto max-w-[1440px] px-4 pb-0 pt-20 sm:px-6 md:px-8">
        <SaleroomTabs
          tabs={tabs}
          activeTab={tab}
          basePath={basePath}
          preservedQuery={preservedQuery}
        >
          {tab === "catalog" ? (
            <>
              <SaleroomLotsGrid
                lots={lotVMs}
                renderActions={(lot) => (
                  <SaleroomLotActions
                    lotId={lot.id}
                    isAuthenticated={isAuthenticated}
                    initialWatching={lot.viewerIsWatching}
                    compact
                  />
                )}
              />
              <SaleroomPaginator
                shown={shownLots}
                total={lotsPage.total}
                page={pageNum}
                pageSize={CATALOG_PAGE_SIZE}
                basePath={basePath}
                preservedQuery={preservedQuery}
                showLoadAll={!isCatalogLoadAll}
              />
            </>
          ) : (
            <SaleroomOverviewPanel overview={overviewVM} />
          )}
        </SaleroomTabs>
      </section>

      {relatedVMs.length > 0 ? (
        <section className="mx-auto mt-20 max-w-[1440px] px-4 sm:px-6 md:px-8">
          <SaleroomRelatedAuctions related={relatedVMs} />
        </section>
      ) : null}
    </main>
  );
}

// Re-export for downstream typed consumption (test helpers, route-level refactors).
export type { SaleLotsPage };
