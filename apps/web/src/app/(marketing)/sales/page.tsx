import { SaleCalendarRow } from "@/components/sections/sales/sale-calendar-row";
import { SalesCategoryFilter } from "@/components/sections/sales/sales-category-filter";
import { SalesFilterBar } from "@/components/sections/sales/sales-filter-bar";
import { SalesFilterLeadChip } from "@/components/sections/sales/sales-filter-lead-chip";
import { SalesHeader } from "@/components/sections/sales/sales-header";
import { SalesTabs } from "@/components/sections/sales/sales-tabs";
import { mapSaleToCalendarRowVM } from "@/components/sections/sales/sales-view-models";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerSalesList } from "@/lib/data/http/sales.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { parseSaleFilter, parseSalesCategoryId } from "@/lib/marketing/sales-filters";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { getSiteUrl } from "@/lib/site-url";
import { Button, EmptyState, SectionCta } from "@auction/ui";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForStatic({
  title: "Calendar",
  description:
    "Explore upcoming auctions and browse past results from London, featuring the best of Modern & Contemporary Art, Design and Luxury.",
  path: "/sales",
});

export default async function SalesListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filter = parseSaleFilter(sp.filter);
  const categories = await getServerCategoryReader()
    .then((r) => r.list())
    .catch(() => []);
  const categoryId = parseSalesCategoryId(sp, categories);

  let rows: Awaited<ReturnType<typeof getServerSalesList>> = [];
  let err: string | null = null;
  try {
    const cat = categoryId ? { categoryId } : {};
    if (filter === "ended") {
      rows = await getServerSalesList({ status: "ended", limit: 48, ...cat });
    } else if (filter === "active") {
      rows = await getServerSalesList({ status: "active", limit: 48, sort: "startAsc", ...cat });
    } else if (filter === "scheduled") {
      rows = await getServerSalesList({ status: "scheduled", limit: 48, sort: "startAsc", ...cat });
    } else {
      rows = await getServerSalesList({
        statuses: ["active", "scheduled"],
        limit: 48,
        sort: "startAsc",
        ...cat,
      });
    }
  } catch (e) {
    err = e instanceof Error ? e.message : "Could not load sales.";
  }

  const session = await getServerSessionUser();
  const base = getSiteUrl();
  const crumbLd = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Calendar", path: "/sales" },
  ]);
  const crumbText = jsonLdScript(crumbLd);
  const listLd =
    !err && rows.length > 0
      ? itemListJsonLd(
          rows.map((r) => ({
            name: r.sale.title,
            url: `${base}/sales/${r.sale.id}`,
          })),
        )
      : null;
  const listLdText = listLd ? jsonLdScript(listLd) : null;

  return (
    <main
      id="main-content"
      className="bg-page-bg px-4 pb-24 pt-20 sm:px-6 md:px-8 dark:bg-background"
    >
      <script type="application/ld+json" suppressHydrationWarning>
        {crumbText}
      </script>
      {listLdText ? (
        <script type="application/ld+json" suppressHydrationWarning>
          {listLdText}
        </script>
      ) : null}

      <div className="mx-auto max-w-[1440px]">
        <div className="flex flex-col gap-12">
          <SalesHeader />
          <div className="flex flex-col">
            <SalesTabs filter={filter} categoryId={categoryId} />
            <SalesFilterBar>
              <SalesFilterLeadChip />
              {categories.length > 0 ? (
                <SalesCategoryFilter
                  filter={filter}
                  categoryId={categoryId}
                  categories={categories}
                />
              ) : null}
            </SalesFilterBar>
          </div>

          {!session ? (
            <SectionCta
              className="mb-0 border border-outline-variant/20 bg-surface/40 dark:border-outline-variant/30"
              title="Ready to bid?"
              description="Create a free account to place bids, track lots, and receive saleroom updates."
              primary={
                <Button variant="cta" asChild>
                  <Link href="/register">Register to bid</Link>
                </Button>
              }
              secondary={
                <Button variant="outline" asChild>
                  <Link href="/login">Sign in</Link>
                </Button>
              }
            />
          ) : null}

          {err ? (
            <p className="text-sm text-error" role="alert">
              {err}
            </p>
          ) : rows.length === 0 ? (
            <EmptyState
              className="border-dashed border-outline-variant/20 bg-surface/30 dark:border-outline-variant/30"
              title="No sales match this filter"
              description="Try another tab or clear the category."
            />
          ) : (
            <ul className="list-none p-0">
              {rows.map(({ sale, lots }) => (
                <SaleCalendarRow key={sale.id} vm={mapSaleToCalendarRowVM(sale, lots)} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
