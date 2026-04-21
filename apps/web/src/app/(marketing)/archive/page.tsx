import { ArchiveFilterBar } from "@/components/sections/archive/archive-filter-bar";
import { ArchivePagination } from "@/components/sections/archive/archive-pagination";
import {
  type ArchiveLotVM,
  PastAuctionsGrid,
} from "@/components/sections/archive/past-auctions-grid";
import { PastAuctionsHeader } from "@/components/sections/archive/past-auctions-header";
import { buildArchivePageQuery } from "@/lib/archive/build-archive-params";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerArchiveMetricsReader, getServerLotReader } from "@/lib/data/http/lots.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getServerPublicUserReader } from "@/lib/data/http/users-public.server";
import { formatMoney } from "@/lib/format-currency";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { getSiteUrl } from "@/lib/site-url";
import type { Category, Lot } from "@auction/types";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = metadataForStatic({
  title: "Past auctions",
  description:
    "Browse past auctions, realized prices, and archived lots from LAX London Auction House Ltd.",
  path: "/archive",
});

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function formatArchiveVolume(totalHammer: string): string {
  const n = Number.parseFloat(totalHammer);
  if (Number.isNaN(n)) return formatMoney(totalHammer);
  if (n >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(1)}M`;
  }
  return formatMoney(totalHammer);
}

function filtersFallback() {
  return (
    <div
      className="mx-auto mb-16 h-24 max-w-screen-2xl animate-pulse rounded-md bg-surface-container-high"
      aria-hidden
    />
  );
}

export default async function ArchivePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const q = buildArchivePageQuery(sp);

  let categories: Category[] = [];
  let totalHammer = "0";
  let auctions: Lot[] = [];
  let totalCount = 0;

  try {
    const [catReader, metricsReader, auctionReader, publicReader, session] = await Promise.all([
      getServerCategoryReader(),
      getServerArchiveMetricsReader(),
      getServerLotReader(),
      getServerPublicUserReader(),
      getServerSessionUser(),
    ]);
    const currentUserId = session?.id ?? null;

    categories = await catReader.list();
    const [summary, count, list] = await Promise.all([
      metricsReader.getEndedSummary(q.endYear),
      metricsReader.countEndedLots({
        ...(q.categoryId !== undefined ? { categoryId: q.categoryId } : {}),
        ...(q.endYear !== undefined ? { endYear: q.endYear } : {}),
      }),
      auctionReader.list(q.listParams),
    ]);
    totalHammer = summary.totalHammer;
    totalCount = count;
    auctions = list;

    const sellerIds = [...new Set(auctions.map((a) => a.sellerId))];
    const nameEntries = await Promise.all(
      sellerIds.map(async (id) => {
        const u = await publicReader.getById(id).catch(() => null);
        return [id, u?.name ?? "Private seller"] as const;
      }),
    );
    const sellerNames = new Map(nameEntries);

    const items: ArchiveLotVM[] = auctions.map((a) => ({
      auction: a,
      sellerName: sellerNames.get(a.sellerId) ?? "Private seller",
    }));

    const totalPages = Math.max(1, Math.ceil(totalCount / q.pageSize));

    const base = getSiteUrl();
    const crumbs = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Past auctions", path: "/archive" },
    ]);
    const itemsLd =
      auctions.length > 0
        ? itemListJsonLd(auctions.map((a) => ({ name: a.title, url: `${base}/artwork/${a.id}` })))
        : null;
    const jsonLdText = jsonLdScript(...(itemsLd ? [crumbs, itemsLd] : [crumbs]));

    return (
      <main
        id="main-content"
        className="bg-surface px-8 pb-24 pt-[var(--section-pt)] text-on-surface md:px-20"
      >
        <script type="application/ld+json" suppressHydrationWarning>
          {jsonLdText}
        </script>
        <PastAuctionsHeader totalVolumeLabel={formatArchiveVolume(totalHammer)} />
        <Suspense fallback={filtersFallback()}>
          <ArchiveFilterBar categories={categories} />
        </Suspense>
        <PastAuctionsGrid items={items} currentUserId={currentUserId} />
        <Suspense fallback={null}>
          <ArchivePagination page={q.page} totalPages={totalPages} />
        </Suspense>
      </main>
    );
  } catch (err) {
    console.error("[ArchivePage]", err);
    return (
      <main id="main-content" className="bg-surface px-8 pb-24 pt-[var(--section-pt)] md:px-20">
        <PastAuctionsHeader totalVolumeLabel="—" />
        <Suspense fallback={filtersFallback()}>
          <ArchiveFilterBar categories={[]} />
        </Suspense>
        <p className="font-body text-on-surface-variant">
          Archive is temporarily unavailable. Check API configuration.
        </p>
      </main>
    );
  }
}
