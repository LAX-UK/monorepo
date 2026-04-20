import { getServerLotReader } from "@/lib/data/http/lots.server";
import { formatMoney } from "@/lib/format-currency";
import { TINY_IMAGE_BLUR } from "@/lib/image-blur";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import { itemListJsonLd } from "@/lib/seo/structured-data";
import { getSiteUrl } from "@/lib/site-url";
import type { Lot } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = metadataForStatic({
  title: "Search lots",
  description:
    "Search curated fine art lots by title or description — filter live inventory from LAX London Auction House Ltd.",
  path: "/search",
});

type PageProps = {
  searchParams: Promise<{ q?: string }>;
};

function matchesQuery(a: Lot, q: string): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return true;
  const t = `${a.title} ${a.description ?? ""}`.toLowerCase();
  return t.includes(n);
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q = "" } = await searchParams;
  const reader = await getServerLotReader();
  let auctions: Lot[] = [];
  let loadError: string | null = null;
  try {
    auctions = await reader.list({ limit: 60 });
  } catch {
    loadError = "We couldn’t load inventory right now. Please try again shortly.";
  }
  const filtered = q.trim() ? auctions.filter((a) => matchesQuery(a, q)) : auctions.slice(0, 24);

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
  const listLdText = listLd ? JSON.stringify(listLd).replace(/</g, "\\u003c") : null;

  return (
    <main
      id="main-content"
      className="mx-auto max-w-[1920px] px-6 pb-24 pt-[var(--section-pt)] md:px-16"
    >
      {listLdText ? (
        <script type="application/ld+json" suppressHydrationWarning>
          {listLdText}
        </script>
      ) : null}
      <h1 className="mb-2 font-headline text-4xl tracking-tight text-on-surface">Search</h1>
      <p className="mb-6 font-body text-sm text-on-surface-variant">
        Filter loaded inventory by title or description.
      </p>
      <form
        action="/search"
        method="get"
        className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end"
      >
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
            placeholder="Title, medium, description…"
            className="rounded-none border-0 border-b-2 border-input-border bg-transparent px-0 shadow-none focus-visible:border-input-border-focus focus-visible:ring-1 focus-visible:ring-input-border-focus"
          />
        </div>
        <Button type="submit" variant="cta" className="h-11 min-h-[44px] shrink-0 px-8">
          Search
        </Button>
      </form>

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
            {q.trim() ? "No lots match that search." : "No lots to show yet."}
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
        <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => {
            const img = a.images[0];
            return (
              <li key={a.id}>
                <Link
                  href={`/artwork/${a.id}`}
                  className="group block overflow-hidden rounded-lg bg-surface-container-low ring-1 ring-outline-variant/10 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="relative aspect-[4/5] bg-surface-container-low">
                    {img ? (
                      <Image
                        src={img}
                        alt={a.title}
                        fill
                        placeholder="blur"
                        blurDataURL={TINY_IMAGE_BLUR}
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, 33vw"
                      />
                    ) : null}
                  </div>
                  <div className="p-5">
                    <h2 className="font-headline text-xl font-light text-on-surface group-hover:italic">
                      {a.title}
                    </h2>
                    <p className="mt-2 font-label text-xs uppercase tracking-widest text-primary">
                      {formatMoney(a.currentPrice)}
                    </p>
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
