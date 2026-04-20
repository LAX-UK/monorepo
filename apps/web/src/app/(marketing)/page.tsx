import { getHomeData } from "@/components/sections/home/get-home-data";
import { HomeNewsletter } from "@/components/sections/home/home-newsletter";
import { LaxArtists } from "@/components/sections/home/lax-artists";
import { LaxHero } from "@/components/sections/home/lax-hero";
import { LaxUpcomingAuctions } from "@/components/sections/home/lax-upcoming-auctions";
import { LaxUpcomingLots } from "@/components/sections/home/lax-upcoming-lots";
import { SITE_TAGLINE } from "@/lib/brand";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";

export const metadata: Metadata = metadataForStatic({
  title: "Fine art auctions",
  description: SITE_TAGLINE,
  path: "/",
});

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function MarketingHomeContent({ twitchParentHost }: { twitchParentHost: string }) {
  const { heroState, lotCards, auctionVm, artistCards, saleMetaLine } = await getHomeData();
  return (
    <>
      <LaxHero state={heroState} twitchParentHost={twitchParentHost} />
      <LaxUpcomingLots items={lotCards} saleMetaLine={saleMetaLine} />
      {auctionVm ? <LaxUpcomingAuctions auction={auctionVm} /> : null}
      <LaxArtists items={artistCards} />
      <HomeNewsletter />
    </>
  );
}

export default async function HomePage({ searchParams }: PageProps) {
  await searchParams;

  const hdrs = await headers();
  const twitchParentHost = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost";

  return (
    <main id="main-content" className="bg-page-bg pt-[var(--header-height)]">
      <Suspense
        fallback={
          <div
            className="min-h-[50vh] w-full animate-pulse bg-surface-container-low"
            aria-hidden
          />
        }
      >
        <MarketingHomeContent twitchParentHost={twitchParentHost} />
      </Suspense>
    </main>
  );
}
