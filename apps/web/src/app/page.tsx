import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { HomeArchive } from "@/components/sections/home/home-archive";
import { HomeFilters } from "@/components/sections/home/home-filters";
import { HomeHero } from "@/components/sections/home/home-hero";
import { HomeMasonry } from "@/components/sections/home/home-masonry";
import { HomeNewsletter } from "@/components/sections/home/home-newsletter";
import { getServerAuctionReader } from "@/lib/data/http/auctions.server";

export default async function HomePage() {
  const reader = await getServerAuctionReader();
  let auctions = await reader.list({ status: "active", limit: 12 });
  if (auctions.length === 0) {
    auctions = await reader.list({ limit: 12 });
  }
  const featured = auctions[0] ?? null;

  return (
    <>
      <SiteHeader />
      <main className="bg-surface pt-24">
        <HomeHero featured={featured} />
        <HomeFilters />
        <HomeMasonry auctions={auctions} />
        <HomeArchive />
        <HomeNewsletter />
      </main>
      <SiteFooter />
    </>
  );
}
