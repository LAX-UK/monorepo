import {
  fetchPublicArtists,
  fetchPublicArtworks,
  fetchPublicCategories,
} from "@/lib/shop-api.server";
import type {
  PublicArtistSummary,
  PublicArtworkSummary,
  PublicCategorySummary,
} from "@auction/shop-contracts";

export type HomeSectionKey = "originals" | "categories" | "prints" | "artists";

export type HomePageComposerResult = {
  originals: PublicArtworkSummary[];
  categories: PublicCategorySummary[];
  prints: PublicArtworkSummary[];
  artists: PublicArtistSummary[];
  sectionErrors: Partial<Record<HomeSectionKey, string>>;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Section unavailable";
}

export async function composeHomePageData(): Promise<HomePageComposerResult> {
  const [originalsResult, categoriesResult, printsResult, artistsResult] = await Promise.allSettled(
    [
      fetchPublicArtworks({ limit: 12, placement: "featured_originals" }),
      fetchPublicCategories({ placement: "featured_categories" }),
      fetchPublicArtworks({ limit: 12, placement: "featured_prints" }),
      fetchPublicArtists({ limit: 12, placement: "featured_artists" }),
    ],
  );

  const sectionErrors: Partial<Record<HomeSectionKey, string>> = {};

  const originals = originalsResult.status === "fulfilled" ? originalsResult.value.items : [];
  if (originalsResult.status === "rejected") {
    sectionErrors.originals = errorMessage(originalsResult.reason);
  }

  const categories = categoriesResult.status === "fulfilled" ? categoriesResult.value.items : [];
  if (categoriesResult.status === "rejected") {
    sectionErrors.categories = errorMessage(categoriesResult.reason);
  }

  const prints = printsResult.status === "fulfilled" ? printsResult.value.items : [];
  if (printsResult.status === "rejected") {
    sectionErrors.prints = errorMessage(printsResult.reason);
  }

  const artists = artistsResult.status === "fulfilled" ? artistsResult.value.items : [];
  if (artistsResult.status === "rejected") {
    sectionErrors.artists = errorMessage(artistsResult.reason);
  }

  return { originals, categories, prints, artists, sectionErrors };
}
