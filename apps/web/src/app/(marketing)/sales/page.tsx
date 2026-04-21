import { SaleEndCountdown } from "@/components/marketing/sale-end-countdown";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerSalesList } from "@/lib/data/http/sales.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { formatMoney } from "@/lib/format-currency";
import { TINY_IMAGE_BLUR } from "@/lib/image-blur";
import { lotEstimateLine } from "@/lib/lot-marketing-display";
import {
  SALE_FILTERS,
  parseSaleFilter,
  parseSalesCategoryId,
  salesHref,
} from "@/lib/marketing/sales-filters";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { getSiteUrl } from "@/lib/site-url";
import { SectionCta, cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = metadataForStatic({
  title: "Sales",
  description:
    "Browse active and scheduled sales — curated catalogs with shared timing and house terms.",
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
      rows = await getServerSalesList({ status: "active", limit: 48, ...cat });
    } else if (filter === "scheduled") {
      rows = await getServerSalesList({ status: "scheduled", limit: 48, ...cat });
    } else {
      const [active, scheduled] = await Promise.all([
        getServerSalesList({ status: "active", limit: 24, ...cat }),
        getServerSalesList({ status: "scheduled", limit: 24, ...cat }),
      ]);
      rows = [...active, ...scheduled];
    }
  } catch (e) {
    err = e instanceof Error ? e.message : "Could not load sales.";
  }

  const session = await getServerSessionUser();
  const base = getSiteUrl();
  const crumbLd = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Sales", path: "/sales" },
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
    <main id="main-content" className="bg-surface px-6 pb-24 pt-[var(--section-pt)] md:px-20">
      <script type="application/ld+json" suppressHydrationWarning>
        {crumbText}
      </script>
      {listLdText ? (
        <script type="application/ld+json" suppressHydrationWarning>
          {listLdText}
        </script>
      ) : null}
      <h1 className="mb-4 font-headline text-4xl tracking-tight md:text-5xl">Sales</h1>
      <p className="mb-8 max-w-2xl font-body text-on-surface-variant">
        Browse umbrella sessions — each sale groups multiple catalogued lots with shared timing and
        house terms.
      </p>

      <nav aria-label="Filter sales" className="mb-10 flex flex-wrap gap-3">
        {SALE_FILTERS.map((f) => {
          const href = salesHref(f, categoryId);
          const active = filter === f;
          return (
            <Link
              key={f}
              href={href}
              className={cn(
                "rounded-full border px-4 py-2 font-label text-xs font-semibold uppercase tracking-widest transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                active
                  ? "border-primary bg-primary/10 text-on-surface"
                  : "border-outline-variant/60 text-on-surface-variant hover:border-primary/50 hover:text-on-surface",
              )}
              aria-current={active ? "page" : undefined}
            >
              {f === "all"
                ? "All"
                : f === "active"
                  ? "Live"
                  : f === "scheduled"
                    ? "Upcoming"
                    : "Past"}
            </Link>
          );
        })}
      </nav>

      {categories.length > 0 ? (
        <nav aria-label="Filter by category" className="mb-10 flex flex-wrap gap-2">
          <Link
            href={salesHref(filter)}
            className={cn(
              "rounded-full border px-3 py-1.5 font-label text-[0.65rem] font-semibold uppercase tracking-wider",
              !categoryId
                ? "border-primary bg-primary/10 text-on-surface"
                : "border-outline-variant/50 text-on-surface-variant hover:border-primary/40",
            )}
            aria-current={!categoryId ? "page" : undefined}
          >
            All categories
          </Link>
          {categories.map((c) => {
            const active = categoryId === c.id;
            const href = salesHref(filter, c.id);
            return (
              <Link
                key={c.id}
                href={href}
                className={cn(
                  "rounded-full border px-3 py-1.5 font-label text-[0.65rem] font-semibold uppercase tracking-wider",
                  active
                    ? "border-primary bg-primary/10 text-on-surface"
                    : "border-outline-variant/50 text-on-surface-variant hover:border-primary/40",
                )}
                aria-current={active ? "page" : undefined}
              >
                {c.name}
              </Link>
            );
          })}
        </nav>
      ) : null}

      {!session ? (
        <SectionCta
          className="mb-12"
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
        <p className="text-on-surface-variant">No sales match this filter.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ sale, lots }) => {
            const img = sale.coverImages[0];
            const estLine = lots.map(lotEstimateLine).find(Boolean) ?? null;
            return (
              <li key={sale.id}>
                <Link
                  href={`/sales/${sale.id}`}
                  className="group block overflow-hidden rounded-xl border border-outline-variant/15 bg-surface-container-low/40 ring-1 ring-outline-variant/10 transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <div className="relative aspect-[16/10] bg-surface-container-low">
                    {img ? (
                      <Image
                        src={img}
                        alt={sale.title}
                        fill
                        placeholder="blur"
                        blurDataURL={TINY_IMAGE_BLUR}
                        className="object-cover transition-transform duration-700 motion-safe:group-hover:scale-105 motion-reduce:group-hover:scale-100"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    ) : (
                      <div
                        className="absolute inset-0 flex items-center justify-center bg-surface-container-high font-label text-xs uppercase tracking-widest text-on-surface-variant"
                        aria-hidden
                      >
                        No cover
                      </div>
                    )}
                    <div className="absolute left-4 top-4 rounded-sm bg-surface/90 px-2 py-1 font-label text-[0.65rem] font-bold uppercase tracking-wider text-on-surface">
                      {sale.status}
                    </div>
                  </div>
                  <div className="p-5">
                    <h2 className="font-headline text-2xl text-on-surface group-hover:text-primary">
                      {sale.title}
                    </h2>
                    <p className="mt-2 font-label text-xs uppercase tracking-widest text-secondary">
                      {lots.length} lot{lots.length === 1 ? "" : "s"} · Ends{" "}
                      {sale.endTime.toLocaleDateString()}
                    </p>
                    <p className="mt-1 font-label text-[0.65rem] uppercase tracking-wider text-on-surface-variant">
                      Closes in:{" "}
                      <SaleEndCountdown
                        end={sale.endTime}
                        className="inline font-label text-[0.65rem]"
                      />
                    </p>
                    {lots[0] ? (
                      <p className="mt-3 font-body text-sm text-on-surface-variant">
                        From {formatMoney(lots[0].currentPrice)} on featured lots
                      </p>
                    ) : null}
                    {estLine ? (
                      <p className="mt-1 font-label text-[0.65rem] uppercase tracking-wider text-primary">
                        Est. {estLine}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
