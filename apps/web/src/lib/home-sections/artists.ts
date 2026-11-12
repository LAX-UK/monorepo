import { artistCardCaption } from "@/lib/artists/artist-card-caption";
import { HOME_SECTION_LIMITS } from "@/lib/home-sections/limits";
import type { HomeArtistCard } from "@/lib/home-sections/types";
import { artistProfileHref } from "@/lib/marketing/catalog-links";
import { marketingArtistFactsLine } from "@auction/marketing-ui/marketing-artist-facts";
import type { PublicArtistDirectoryRow } from "@auction/types";

/**
 * Artists the house holds work by: with a lot on sale or a sold result. Artists without either
 * are the directory's business, not the home page's. `null` below the minimum.
 */
export function buildHomeArtists(
  rows: readonly PublicArtistDirectoryRow[],
): HomeArtistCard[] | null {
  const shown = rows
    .filter((row) => row.lotCount > 0 || row.resultCount > 0)
    .slice(0, HOME_SECTION_LIMITS.artists.max)
    .map(
      (row): HomeArtistCard => ({
        id: row.id,
        name: row.displayName,
        href: artistProfileHref({ id: row.id, name: row.displayName }),
        facts: marketingArtistFactsLine({
          nationality: row.nationality,
          birthYear: row.birthYear,
          deathYear: row.deathYear,
        }),
        caption: artistCardCaption(row),
        portraitUrl: row.portraitUrl ?? row.heroImageUrl ?? null,
        workImageUrl: row.workImageUrl,
      }),
    );
  return shown.length >= HOME_SECTION_LIMITS.artists.min ? shown : null;
}
