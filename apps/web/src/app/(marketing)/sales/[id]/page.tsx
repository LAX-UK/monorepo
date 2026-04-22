import { SaleMobileSummaryBar } from "@/components/marketing/sale-mobile-summary-bar";
import {
  mapBidderRowVM,
  mapLotToCardVM,
  mapSaleToHeroVM,
  mapSaleToRelatedVM,
} from "@/components/sections/saleroom/mappers";
import { SaleroomBiddersPanel } from "@/components/sections/saleroom/saleroom-bidders-panel";
import { SaleroomHero } from "@/components/sections/saleroom/saleroom-hero";
import { SaleroomHeroActions } from "@/components/sections/saleroom/saleroom-hero-actions";
import { SaleroomLotActions } from "@/components/sections/saleroom/saleroom-lot-actions";
import { SaleroomLotsGrid } from "@/components/sections/saleroom/saleroom-lots-grid";
import { SaleroomPaginator } from "@/components/sections/saleroom/saleroom-paginator";
import { SaleroomRelatedAuctions } from "@/components/sections/saleroom/saleroom-related-auctions";
import {
  SaleroomTabs,
  type TabDescriptor,
  type TabKey,
} from "@/components/sections/saleroom/saleroom-tabs";
import { SITE_TAGLINE } from "@/lib/brand";
import {
  getServerRelatedSales,
  getServerSaleBidders,
  getServerSaleFollowState,
} from "@/lib/data/http/saleroom.server";
import {
  type SaleLotsPage,
  getServerSaleLotsPage,
  getServerSaleWithLots,
} from "@/lib/data/http/sales.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { metadataForSale, metadataForStatic } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { getSiteUrl } from "@/lib/site-url";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const revalidate = 0;

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const CATALOG_PAGE_SIZE = 12;
const BIDDERS_PAGE_SIZE = 24;
const ALLOWED_SORTS = ["lot", "priceAsc", "priceDesc", "endingAsc"] as const;
type CatalogSort = (typeof ALLOWED_SORTS)[number];

function firstString(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return typeof v === "string" ? v : v[0];
}

function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 500) : 1;
}

function parseSort(raw: string | undefined): CatalogSort {
  return (ALLOWED_SORTS as readonly string[]).includes(raw ?? "") ? (raw as CatalogSort) : "lot";
}

function parseTab(raw: string | undefined): TabKey {
  return raw === "bidders" ? "bidders" : "catalog";
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

export default async function SaleDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = parseTab(firstString(sp.tab));
  const page = parsePage(firstString(sp.page));
  const sort = parseSort(firstString(sp.sort));

  const [bundle, lotsPage, session] = await Promise.all([
    getServerSaleWithLots(id).catch(() => null),
    getServerSaleLotsPage({ id, page, pageSize: CATALOG_PAGE_SIZE, sort }).catch(() => null),
    getServerSessionUser(),
  ]);
  if (!bundle || !lotsPage) notFound();

  const categoryId = bundle.sale.categoryId ?? null;
  const [bidders, follow, relatedSales] = await Promise.all([
    tab === "bidders"
      ? getServerSaleBidders({ id, page, pageSize: BIDDERS_PAGE_SIZE }).catch(() => null)
      : Promise.resolve(null),
    session
      ? getServerSaleFollowState(id).catch(() => ({ isFollowing: false }))
      : Promise.resolve({ isFollowing: false }),
    getServerRelatedSales({ id, categoryId, limit: 4 }).catch(() => []),
  ]);

  const base = getSiteUrl();
  const viewerUserId = session?.id ?? null;
  const shareUrl = `${base}/sales/${bundle.sale.id}`;
  const basePath = `/sales/${bundle.sale.id}`;
  const preservedQuery: Array<[string, string]> = [
    ["tab", tab],
    ["sort", sort],
  ];

  const heroVM = mapSaleToHeroVM(bundle.sale, {
    totalLots: lotsPage.total,
    shareUrl,
  });

  const tabs: TabDescriptor[] = [
    { key: "catalog", label: "Catalog", count: lotsPage.total },
    typeof bidders?.total === "number"
      ? { key: "bidders", label: "Registered bidders", count: bidders.total }
      : { key: "bidders", label: "Registered bidders" },
  ];

  const shownLots = Math.min(page * CATALOG_PAGE_SIZE, lotsPage.total);
  const accumulatedLotIds = new Set<string>();
  const lotVMs = lotsPage.items
    .filter((lot) => {
      if (accumulatedLotIds.has(lot.id)) return false;
      accumulatedLotIds.add(lot.id);
      return true;
    })
    .map((lot) => mapLotToCardVM(lot, { viewerUserId }));

  const relatedVMs = relatedSales.map((r) => mapSaleToRelatedVM(r.sale, r.lotCount));

  const crumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Auctions", path: "/sales" },
    { name: bundle.sale.title, path: basePath },
  ]);

  // Structured data lists only the current page of lots to keep payload small (SEO + perf).
  const itemsLd =
    lotVMs.length > 0
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
    <main id="main-content" className="bg-surface pb-32 pt-(--section-pt) lg:pb-24">
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
        actions={
          <SaleroomHeroActions
            saleId={bundle.sale.id}
            saleTitle={bundle.sale.title}
            shareUrl={shareUrl}
            isAuthenticated={isAuthenticated}
            initialFollowing={bundle.viewer?.isFollowing ?? follow.isFollowing ?? false}
            registerHref={registerHref}
            showRegisterCta={showRegisterCta}
          />
        }
      />

      <section id="catalog" className="mx-auto max-w-screen-2xl px-6 pt-10 md:px-20">
        <SaleroomTabs
          tabs={tabs}
          activeTab={tab}
          basePath={basePath}
          preservedQuery={preservedQuery}
        >
          {tab === "catalog" ? (
            <>
              <CatalogSortBar basePath={basePath} activeSort={sort} tab={tab} />
              <SaleroomLotsGrid
                lots={lotVMs}
                renderActions={(lot) => (
                  <SaleroomLotActions lotId={lot.id} isAuthenticated={isAuthenticated} compact />
                )}
              />
              <SaleroomPaginator
                shown={shownLots}
                total={lotsPage.total}
                page={page}
                pageSize={CATALOG_PAGE_SIZE}
                basePath={basePath}
                preservedQuery={preservedQuery}
              />
            </>
          ) : (
            <>
              {bidders ? (
                <SaleroomBiddersPanel
                  bidders={bidders.items.map(mapBidderRowVM)}
                  total={bidders.total}
                />
              ) : (
                <SaleroomBiddersPanel bidders={[]} total={0} />
              )}
              {bidders ? (
                <SaleroomPaginator
                  shown={Math.min(page * BIDDERS_PAGE_SIZE, bidders.total)}
                  total={bidders.total}
                  page={page}
                  pageSize={BIDDERS_PAGE_SIZE}
                  basePath={basePath}
                  preservedQuery={preservedQuery}
                  unitLabel="bidders"
                />
              ) : null}
            </>
          )}
        </SaleroomTabs>
      </section>

      {relatedVMs.length > 0 ? (
        <section className="mx-auto mt-16 max-w-screen-2xl px-6 md:px-20">
          <SaleroomRelatedAuctions related={relatedVMs} />
        </section>
      ) : null}
    </main>
  );
}

function CatalogSortBar({
  basePath,
  activeSort,
  tab,
}: {
  basePath: string;
  activeSort: CatalogSort;
  tab: TabKey;
}) {
  const links: Array<{ key: CatalogSort; label: string }> = [
    { key: "lot", label: "Catalog order" },
    { key: "endingAsc", label: "Ending soon" },
    { key: "priceDesc", label: "Price · High" },
    { key: "priceAsc", label: "Price · Low" },
  ];
  return (
    <nav aria-label="Sort catalog" className="mb-6 flex flex-wrap gap-2">
      {links.map(({ key, label }) => {
        const qs = new URLSearchParams({ tab });
        if (key !== "lot") qs.set("sort", key);
        const href = `${basePath}?${qs.toString()}`;
        const active = activeSort === key;
        return (
          <a
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 font-label text-[0.65rem] font-semibold uppercase tracking-wider transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              active
                ? "border-primary bg-primary/10 text-on-surface"
                : "border-outline-variant/50 text-on-surface-variant hover:border-primary/40 hover:text-on-surface"
            }`}
          >
            {label}
          </a>
        );
      })}
    </nav>
  );
}

// Re-export for downstream typed consumption (test helpers, route-level refactors).
export type { SaleLotsPage };
