import { HomeArchive } from "@/components/sections/home/home-archive";
import { HomeFilters } from "@/components/sections/home/home-filters";
import { HomeHero } from "@/components/sections/home/home-hero";
import { HomeMasonry } from "@/components/sections/home/home-masonry";
import { HomeNewsletter } from "@/components/sections/home/home-newsletter";
import type { ListAuctionsParams } from "@/lib/data/contracts";
import { getServerAuctionReader } from "@/lib/data/http/auctions.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import type { Auction, Category } from "@auction/types";
import { Suspense } from "react";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function filtersBarFallback() {
  return (
    <div
      className="mb-20 mx-4 h-24 max-w-[1920px] animate-pulse rounded-md bg-surface-container-high md:mx-10 lg:mx-20"
      aria-hidden
    />
  );
}

export default async function HomePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const categoryId = typeof sp.categoryId === "string" ? sp.categoryId : undefined;
  const sellerId = typeof sp.sellerId === "string" ? sp.sellerId : undefined;
  const minRaw = typeof sp.min === "string" ? sp.min : undefined;
  const maxRaw = typeof sp.max === "string" ? sp.max : undefined;
  const minN = minRaw !== undefined ? Number.parseFloat(minRaw) : Number.NaN;
  const maxN = maxRaw !== undefined ? Number.parseFloat(maxRaw) : Number.NaN;

  let auctions: Auction[] = [];
  let categories: Category[] = [];
  try {
    const reader = await getServerAuctionReader();
    const catReader = await getServerCategoryReader();
    categories = await catReader.list();
    const filtered: ListAuctionsParams = {
      limit: 24,
      status: "active",
      sort: "endingAsc",
      ...(categoryId !== undefined ? { categoryId } : {}),
      ...(sellerId !== undefined ? { sellerId } : {}),
    };
    auctions = await reader.list(filtered);
    if (auctions.length === 0) {
      const fallback: ListAuctionsParams = {
        limit: 24,
        sort: "endingAsc",
        ...(categoryId !== undefined ? { categoryId } : {}),
        ...(sellerId !== undefined ? { sellerId } : {}),
      };
      auctions = await reader.list(fallback);
    }
    if (!Number.isNaN(minN)) {
      auctions = auctions.filter((a) => Number.parseFloat(a.currentPrice) >= minN);
    }
    if (!Number.isNaN(maxN)) {
      auctions = auctions.filter((a) => Number.parseFloat(a.currentPrice) <= maxN);
    }
    if (auctions.length === 0) {
      auctions = await reader.list({ limit: 12, sort: "endingAsc" });
    }
  } catch (err) {
    categories = [];
    console.error(
      "[HomePage] auction list failed (API down or misconfigured INTERNAL_API_URL?)",
      err,
    );
  }
  const featured = auctions[0] ?? null;

  return (
    <main id="main-content" className="bg-surface pt-24">
      <HomeHero featured={featured} />
      <Suspense fallback={filtersBarFallback()}>
        <HomeFilters categories={categories} />
      </Suspense>
      <HomeMasonry auctions={auctions} />
      <HomeArchive />
      <HomeNewsletter />
    </main>
  );
}
