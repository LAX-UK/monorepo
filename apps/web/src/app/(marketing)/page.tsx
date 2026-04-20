import { getHomeData } from "@/components/sections/home/get-home-data";
import { HomeNewsletter } from "@/components/sections/home/home-newsletter";
import { LaxArtists } from "@/components/sections/home/lax-artists";
import { LaxHero } from "@/components/sections/home/lax-hero";
import { LaxUpcomingAuctions } from "@/components/sections/home/lax-upcoming-auctions";
import { LaxUpcomingLots } from "@/components/sections/home/lax-upcoming-lots";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: PageProps) {
  await searchParams;

  const { heroVm, lotCards, auctionVm, artistCards, saleMetaLine } = await getHomeData();

  return (
    <main id="main-content" className="bg-page-bg pt-[var(--header-height)]">
      <LaxHero lot={heroVm} />
      <LaxUpcomingLots items={lotCards} saleMetaLine={saleMetaLine} />
      {auctionVm ? <LaxUpcomingAuctions auction={auctionVm} /> : null}
      <LaxArtists items={artistCards} />
      <HomeNewsletter />
    </main>
  );
}
