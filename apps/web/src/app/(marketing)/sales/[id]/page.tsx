import { OwnerBadge } from "@/components/marketing/owner-badge";
import { SaleMobileSummaryBar } from "@/components/marketing/sale-mobile-summary-bar";
import { ShareButton } from "@/components/marketing/share-button";
import { SITE_TAGLINE } from "@/lib/brand";
import { getServerSaleWithLots } from "@/lib/data/http/sales.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { formatMoney } from "@/lib/format-currency";
import { TINY_IMAGE_BLUR } from "@/lib/image-blur";
import { lotEstimateLine } from "@/lib/lot-marketing-display";
import { metadataForSale, metadataForStatic } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { getSiteUrl } from "@/lib/site-url";
import type { Lot } from "@auction/types";
import { cn } from "@auction/ui";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstString(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return typeof v === "string" ? v : v[0];
}

function parsePrice(p: string) {
  return Number.parseFloat(p) || 0;
}

function sortCatalogLots(lots: Lot[], sort: string | undefined): Lot[] {
  const copy = [...lots];
  const mode = sort ?? "lot";
  switch (mode) {
    case "priceAsc":
      return copy.sort((a, b) => parsePrice(a.currentPrice) - parsePrice(b.currentPrice));
    case "priceDesc":
      return copy.sort((a, b) => parsePrice(b.currentPrice) - parsePrice(a.currentPrice));
    case "endingAsc":
      return copy.sort((a, b) => a.endTime.getTime() - b.endTime.getTime());
    default:
      return copy.sort((a, b) => (a.lotNumber ?? 999_999) - (b.lotNumber ?? 999_999));
  }
}

const SORT_LINKS = [
  { key: "lot", label: "Catalog order" },
  { key: "endingAsc", label: "Ending soon" },
  { key: "priceDesc", label: "Price · High" },
  { key: "priceAsc", label: "Price · Low" },
] as const;

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
  const sortKey = firstString(sp.sort);

  const [bundle, session] = await Promise.all([
    getServerSaleWithLots(id).catch(() => null),
    getServerSessionUser(),
  ]);
  if (!bundle) notFound();

  const { sale, lots } = bundle;
  const sortedLots = sortCatalogLots(lots, sortKey);
  const currentUserId = session?.id ?? null;
  const hero = sale.coverImages[0];
  const base = getSiteUrl();
  const crumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Sales", path: "/sales" },
    { name: sale.title, path: `/sales/${sale.id}` },
  ]);
  const itemsLd =
    sortedLots.length > 0
      ? itemListJsonLd(
          sortedLots.map((lot) => ({
            name: lot.title,
            url: `${base}/artwork/${lot.id}`,
          })),
        )
      : null;
  const jsonLdText = jsonLdScript(...(itemsLd ? [crumbs, itemsLd] : [crumbs]));

  return (
    <main id="main-content" className="bg-surface pb-32 pt-[var(--section-pt)] lg:pb-24">
      <script type="application/ld+json" suppressHydrationWarning>
        {jsonLdText}
      </script>
      <SaleMobileSummaryBar end={sale.endTime} saleTitle={sale.title} showRegisterCta={!session} />
      <div className="relative mx-auto max-w-[1920px]">
        <div className="relative h-[42vh] min-h-[280px] w-full bg-surface-container-low md:h-[48vh]">
          {hero ? (
            <Image
              src={hero}
              alt={sale.title}
              fill
              priority
              placeholder="blur"
              blurDataURL={TINY_IMAGE_BLUR}
              className="object-cover"
              sizes="100vw"
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-container-high to-surface-container-low"
              aria-hidden
            >
              <span className="font-headline text-2xl text-on-surface-variant">{sale.title}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 px-6 pb-10 md:px-20">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <nav className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
                <Link
                  href="/sales"
                  className="hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Sales
                </Link>
                <span className="mx-2" aria-hidden>
                  /
                </span>
                <span className="text-on-surface" aria-current="page">
                  {sale.title}
                </span>
              </nav>
              <ShareButton
                url={`${base}/sales/${sale.id}`}
                title={sale.title}
                className="shrink-0"
              />
            </div>
            <h1 className="max-w-4xl font-headline text-4xl tracking-tight text-on-surface md:text-6xl">
              {sale.title}
            </h1>
            <p className="mt-4 max-w-2xl font-body text-on-surface-variant">
              {sale.description ?? "Curated catalog — explore individual lots below."}
            </p>
            <p className="mt-4 font-label text-xs uppercase tracking-widest text-secondary">
              {sale.status} · Closes{" "}
              {sale.endTime.toLocaleString(undefined, { timeZoneName: "short" })}
            </p>
          </div>
        </div>
      </div>

      <section id="catalog" className="mx-auto max-w-screen-2xl px-6 pt-16 md:px-20">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <h2 className="font-headline text-2xl">Catalog</h2>
          <nav aria-label="Sort catalog" className="flex flex-wrap gap-2">
            {SORT_LINKS.map(({ key, label }) => {
              const active = (sortKey ?? "lot") === key;
              const href = key === "lot" ? `/sales/${sale.id}` : `/sales/${sale.id}?sort=${key}`;
              return (
                <Link
                  key={key}
                  href={href}
                  className={cn(
                    "rounded-full border px-3 py-1.5 font-label text-[0.65rem] font-semibold uppercase tracking-wider transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                    active
                      ? "border-primary bg-primary/10 text-on-surface"
                      : "border-outline-variant/50 text-on-surface-variant hover:border-primary/40 hover:text-on-surface",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        {sortedLots.length === 0 ? (
          <p className="text-on-surface-variant">No lots in this sale yet.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {sortedLots.map((lot) => {
              const img = lot.images[0];
              const est = lotEstimateLine(lot);
              return (
                <li
                  key={lot.id}
                  className="flex flex-col overflow-hidden rounded-lg bg-surface-container-low/50 ring-1 ring-outline-variant/10"
                >
                  <Link
                    href={`/artwork/${lot.id}`}
                    className="group block flex-1 transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <div className="relative aspect-[4/5] bg-surface-container-low">
                      {img ? (
                        <Image
                          src={img}
                          alt={lot.title}
                          fill
                          className="object-cover transition-transform duration-700 motion-safe:group-hover:scale-105 motion-reduce:group-hover:scale-100"
                          sizes="(max-width: 768px) 100vw, 33vw"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-surface-container-high text-xs text-on-surface-variant">
                          No image
                        </div>
                      )}
                      <OwnerBadge
                        owned={Boolean(currentUserId && lot.sellerId === currentUserId)}
                        className="absolute right-3 top-3"
                      />
                      {lot.lotNumber != null ? (
                        <span className="absolute left-3 top-3 rounded-sm bg-surface/90 px-2 py-1 font-label text-[0.65rem] font-bold uppercase tracking-wider">
                          Lot {lot.lotNumber}
                        </span>
                      ) : null}
                    </div>
                    <div className="p-4">
                      <h3 className="font-headline text-lg text-on-surface group-hover:text-primary">
                        {lot.title}
                      </h3>
                      <p className="mt-2 font-label text-xs uppercase tracking-widest text-secondary">
                        {lot.status} · {formatMoney(lot.currentPrice)}
                      </p>
                      {est ? (
                        <p className="mt-1 font-label text-[0.65rem] uppercase tracking-wider text-primary">
                          Est. {est}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                  <div className="border-t border-outline-variant/15 px-4 py-3">
                    <Link
                      href={`/artwork/${lot.id}`}
                      className="inline-flex min-h-11 items-center font-label text-xs font-bold uppercase tracking-widest text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      Bid now
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
