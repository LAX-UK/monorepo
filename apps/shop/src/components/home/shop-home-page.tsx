import { HomeHero } from "@/components/home/sections/home-hero";
import {
  HomeArtistsSection,
  HowEditionsWorkSection,
  NewEditionsSection,
} from "@/components/home/sections/home-sections";
import { composeHomePageData } from "@/lib/home/home-page.composer";
import { buildHomePageViewModel } from "@/lib/home/home-page.vm";

export async function ShopHomePage() {
  const vm = buildHomePageViewModel(await composeHomePageData());

  return (
    <>
      <HomeHero hero={vm.hero} />
      <NewEditionsSection editions={vm.editions} errorMessage={vm.sectionErrors.editions} />
      <HomeArtistsSection artists={vm.artists} />
      <HowEditionsWorkSection steps={vm.steps} />
    </>
  );
}
