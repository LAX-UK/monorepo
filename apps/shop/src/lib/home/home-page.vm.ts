import type { HomeArtistCard, HomeCategoryCard, HomePrintCard } from "@/content/home-marketing";
import { homeHero, homeSections, homeSignup } from "@/content/home-marketing";
import { buildArtistRailCards } from "@/lib/home/artists-rail.vm";
import { buildCategoryRailCards } from "@/lib/home/categories-rail.vm";
import { buildPrintRailCards } from "@/lib/home/prints-rail.vm";
import type { HomePageComposerResult, HomeSectionKey } from "./home-page.composer.js";

export type HomePageViewModel = {
  hero: typeof homeHero;
  sections: typeof homeSections;
  signup: typeof homeSignup;
  categories: HomeCategoryCard[];
  artists: HomeArtistCard[];
  printCards: HomePrintCard[];
  sectionErrors: Partial<Record<HomeSectionKey, string>>;
};

export function buildHomePageViewModel(input: HomePageComposerResult): HomePageViewModel {
  return {
    hero: homeHero,
    sections: homeSections,
    signup: homeSignup,
    categories: buildCategoryRailCards(input.categories),
    artists: buildArtistRailCards(input.artists),
    printCards: buildPrintRailCards(input.prints),
    sectionErrors: input.sectionErrors,
  };
}
