import { OwnerBadge } from "@/components/marketing/owner-badge";
import type { ListLotsParams } from "@/lib/data/contracts";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerLotReader } from "@/lib/data/http/lots.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { formatMoney } from "@/lib/format-currency";
import { TINY_IMAGE_BLUR } from "@/lib/image-blur";
import { lotEstimateLine } from "@/lib/lot-marketing-display";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { getSiteUrl } from "@/lib/site-url";
import type { Lot } from "@auction/types";
import { SectionCta } from "@auction/ui";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = metadataForStatic({
  title: "Search lots",
  description:
    "Search curated fine art lots by title — browse live inventory from LAX London Auction House Ltd.",
  path: "/search",
});

const PAGE_SIZE = 24;

type PageProps = {
  searchParams: Promise<{ q?: string; offset?: string; sort?: string; categoryId?: string }>;
};

function firstString(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return typeof v === "string" ? v : v[0];
}

function parseSort(v: string | undefined): NonNullable<ListLotsParams["sort"]> {
  if (v === "createdDesc" || v === "hammerDesc" || v === "endingAsc") return v;
  return "endingAsc";
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q = "", offset: offsetRaw = "0", sort: sortRaw, categoryId: catRaw } = await searchParams;
  const offset = Math.max(0, Number.parseInt(String(offsetRaw), 10) || 0);
  const trimmed = String(q).trim();
  const sort = parseSort(firstString(sortRaw));
  const categoryId = firstString(catRaw);

  const [reader, session, catReader] = await Promise.all([
    getServerLotReader(),
    getServerSessionUser(),
    getServerCategoryReader().catch(() => null),
  ]);
  const categories = catReader ? await catReader.list().catch(() => []) : [];

  const currentUserId = session?.id ?? null;
  let auctions: Lot[] = [];
  let loadError: string | null = null;
  try {
    const fetchLimit = PAGE_SIZE + 1;
    auctions = await reader.list({
      limit: fetchLimit,
      offset,
      ...(trimmed ? { q: trimmed } : {}),
      sort,
      ...(categoryId ? { categoryId } : {}),
    });
  } catch {
    loadError = "We couldn’t load inventory right now. Please try again shortly.";
  }
  const hasNext = auctions.length > PAGE_SIZE;
  const filtered = hasNext ? auctions.slice(0, PAGE_SIZE) : auctions;
  const hasPrev = offset > 0;
  const nextOffset = offset + PAGE_SIZE;
  const prevOffset = Math.max(0, offset - PAGE_SIZE);

  const qParam = trimmed ? `&q=${encodeURIComponent(trimmed)}` : "";
  const sortParam = sort !== "endingAsc" ? `&sort=${sort}` : "";
  const catParam = categoryId ? `&categoryId=${encodeURIComponent(categoryId)}` : "";

  const base = getSiteUrl();
  const listLd =
    filtered.length > 0
      ? itemListJsonLd(
          filtered.map((a) => ({
            name: a.title,
            url: `${base}/artwork/${a.id}`,
          })),
        )
      : null;
  const crumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Search", path: "/search" },
  ]);
  const listLdText = listLd ? jsonLdScript(crumbs, listLd) : jsonLdScript(crumbs);

  const sortLinks = [
    { key: "endingAsc" as const, label: "Ending soon" },
    { key: "createdDesc" as const, label: "Newest" },
    { key: "hammerDesc" as const, label: "Price · High" },
  ];

  return (
    <main
      id="main-content"
      className="mx-auto max-w-[1920px] bg-surface px-6 pb-24 pt-[var(--section-pt)] md:px-16"
    >
      <script type="application/ld+json" suppressHydrationWarning>
        {listLdText}
      </script>
      <h1 className="mb-2 font-headline text-4xl tracking-tight text-on-surface">Search</h1>
      <p className="mb-6 font-body text-sm text-on-surface-variant">
        Search runs on the server across lot titles. Use filters to narrow by category or sort
        order.
      </p>
      <form
        action="/search"
        method="get"
        className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <input type="hidden" name="offset" value="0" />
        {sort !== "endingAsc" ? <input type="hidden" name="sort" value={sort} /> : null}
        {categoryId ? <input type="hidden" name="categoryId" value={categoryId} /> : null}
        <div className="min-w-0 flex-1">
          <label
            htmlFor="search-q"
            className="mb-2 block font-label text-xs uppercase tracking-widest text-secondary"
          >
            Keywords
          </label>
          <Input
            id="search-q"
            name="q"
            defaultValue={q}
            placeholder="Search by lot title…"
            className="rounded-none border-0 border-b-2 border-input-border bg-transparent px-0 shadow-none focus-visible:border-input-border-focus focus-visible:ring-1 focus-visible:ring-input-border-focus"
          />
        </div>
        <Button type="submit" variant="cta" className="h-11 min-h-[44px] shrink-0 px-8">
          Search
        </Button>
      </form>

      {categories.length > 0 ? (
        <div className="mb-8">
          <p className="mb-2 font-label text-xs uppercase tracking-widest text-secondary">
            Category
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/search?offset=0${qParam}${sortParam}`}
              className={cn(
                "rounded-full border px-3 py-1.5 font-label text-[0.65rem] font-semibold uppercase tracking-wider",
                !categoryId
                  ? "border-primary bg-primary/10 text-on-surface"
                  : "border-outline-variant/50 text-on-surface-variant hover:border-primary/40",
              )}
              aria-current={!categoryId ? "page" : undefined}
            >
              All
            </Link>
            {categories.map((c) => {
              const active = categoryId === c.id;
              const href = `/search?offset=0&categoryId=${encodeURIComponent(c.id)}${qParam}${sortParam}`;
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
          </div>
        </div>
      ) : null}

      <nav aria-label="Sort results" className="mb-8 flex flex-wrap gap-2">
        {sortLinks.map(({ key, label }) => {
          const active = sort === key;
          const href = `/search?offset=0${trimmed ? `&q=${encodeURIComponent(trimmed)}` : ""}${
            key !== "endingAsc" ? `&sort=${key}` : ""
          }${catParam}`;
          return (
            <Link
              key={key}
              href={href}
              className={cn(
                "rounded-full border px-3 py-1.5 font-label text-[0.65rem] font-semibold uppercase tracking-wider",
                active
                  ? "border-primary bg-primary/10 text-on-surface"
                  : "border-outline-variant/50 text-on-surface-variant hover:border-primary/40",
              )}
              aria-current={active ? "page" : undefined}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {loadError ? (
        <div
          className="rounded-xl border border-error/30 bg-error-container/20 px-8 py-12 text-center"
          role="alert"
        >
          <p className="font-body text-on-error-container">{loadError}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low/50 px-8 py-12 text-center ring-1 ring-outline-variant/10">
          <p className="mb-6 font-body text-on-surface-variant">
            {trimmed ? "No lots match that search." : "No lots to show yet."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/archive"
              className="font-label text-xs font-bold uppercase tracking-widest text-primary underline-offset-4 hover:underline"
            >
              Browse past auctions
            </Link>
            <span className="text-on-surface-variant/50" aria-hidden>
              ·
            </span>
            <Link
              href="/"
              className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant underline-offset-4 hover:text-primary hover:underline"
            >
              Upcoming auctions
            </Link>
          </div>
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((a) => {
              const img = a.images[0];
              const est = lotEstimateLine(a);
              return (
                <li key={a.id}>
                  <Link
                    href={`/artwork/${a.id}`}
                    className="group block overflow-hidden rounded-lg bg-surface-container-low ring-1 ring-outline-variant/10 shadow-sm transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <div className="relative aspect-[4/5] bg-surface-container-low">
                      {img ? (
                        <Image
                          src={img}
                          alt={a.title}
                          fill
                          placeholder="blur"
                          blurDataURL={TINY_IMAGE_BLUR}
                          className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-105 motion-reduce:group-hover:scale-100"
                          sizes="(max-width: 640px) 100vw, 33vw"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-surface-container-high text-xs text-on-surface-variant">
                          No image
                        </div>
                      )}
                      <OwnerBadge
                        owned={Boolean(currentUserId && a.sellerId === currentUserId)}
                        className="absolute right-3 top-3"
                      />
                    </div>
                    <div className="p-5">
                      <h2 className="font-headline text-xl font-light text-on-surface group-hover:text-primary">
                        {a.title}
                      </h2>
                      <p className="mt-2 font-label text-xs uppercase tracking-widest text-primary">
                        {formatMoney(a.currentPrice)}
                      </p>
                      {est ? (
                        <p className="mt-1 font-label text-[0.65rem] uppercase tracking-wider text-on-surface-variant">
                          Est. {est}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <nav
            className="mt-12 flex flex-wrap items-center justify-center gap-6 border-t border-outline-variant/15 pt-10 font-label text-xs font-semibold uppercase tracking-widest"
            aria-label="Search results pagination"
          >
            {hasPrev ? (
              <Link
                href={`/search?offset=${prevOffset}${qParam}${sortParam}${catParam}`}
                className="text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Previous
              </Link>
            ) : (
              <span className="text-on-surface-variant/40">Previous</span>
            )}
            {hasNext ? (
              <Link
                href={`/search?offset=${nextOffset}${qParam}${sortParam}${catParam}`}
                className="text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Next
              </Link>
            ) : (
              <span className="text-on-surface-variant/40">Next</span>
            )}
          </nav>
          {!session ? (
            <SectionCta
              className="mt-16"
              title="Ready to bid?"
              description="Create a free account to place bids and track lots you care about."
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
        </>
      )}
    </main>
  );
}
