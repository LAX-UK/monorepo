import { ArtistPortraitFrame } from "@/components/marketing/artist-portrait-frame";
import { ArtistWatchHeart } from "@/components/marketing/artist-watch-heart";
import { MediaImage } from "@/components/ui/media-image";
import { artistKindMeta } from "@/lib/artists/kind-presenter";
import type { ArtistProfileLinkContext } from "@/lib/marketing/catalog-links";
import { artistProfileHref } from "@/lib/marketing/catalog-links";
import { MarketingArtistCard, marketingArtistFactsLine } from "@auction/marketing-ui";
import type { PublicArtistDirectoryRow } from "@auction/types";
import { Badge, cn } from "@auction/ui";

type Props = {
  artist: PublicArtistDirectoryRow;
  watching: boolean;
  isAuthenticated: boolean;
  profileLinkContext?: ArtistProfileLinkContext;
  density?: "default" | "compact";
  /** Heading level for the name; the directory grid and rails set it under their own headings. */
  nameAs?: "h2" | "h3" | "h4";
  className?: string;
};

/**
 * What the card says the house holds for the artist: "3 lots" when anything is listed, otherwise
 * "2 results" for sold work; null when there is neither.
 */
export function artistCardCaption(input: { lotCount: number; resultCount: number }): string | null {
  if (input.lotCount > 0) return `${input.lotCount} ${input.lotCount === 1 ? "lot" : "lots"}`;
  if (input.resultCount > 0) {
    return `${input.resultCount} ${input.resultCount === 1 ? "result" : "results"}`;
  }
  return null;
}

/** Public artist directory card: the shared `MarketingArtistCard` with Bid's watch heart. */
export function ArtistDirectoryCard({
  artist,
  watching,
  isAuthenticated,
  profileLinkContext,
  density = "default",
  nameAs,
  className,
}: Props) {
  const isCompact = density === "compact";
  const href = artistProfileHref({ id: artist.id, name: artist.displayName }, profileLinkContext);
  const isBrand = artist.kind === "brand" || artist.kind === "marque";
  const kindBadge =
    !isCompact && artist.kind && artist.kind !== "artist"
      ? artistKindMeta(artist.kind).badge
      : null;
  const portraitSrc = artist.portraitUrl ?? artist.heroImageUrl;
  const textOnly = !portraitSrc && !artist.workImageUrl;

  const heart = (
    <ArtistWatchHeart
      artistId={artist.id}
      artistName={artist.displayName}
      initialWatching={watching}
      isAuthenticated={isAuthenticated}
      loginNextPath={href}
      {...(textOnly ? { surface: "inline" as const } : {})}
    />
  );

  return (
    <li className={cn("min-w-0", className)}>
      <MarketingArtistCard
        href={href}
        name={artist.displayName}
        nameAs={nameAs ?? (isCompact ? "h3" : "h2")}
        density={density}
        facts={marketingArtistFactsLine({
          nationality: artist.nationality,
          birthYear: artist.birthYear,
          deathYear: artist.deathYear,
        })}
        caption={artistCardCaption(artist)}
        {...(portraitSrc
          ? {
              portrait: (
                <ArtistPortraitFrame
                  src={portraitSrc}
                  alt={isBrand ? "" : `Portrait of ${artist.displayName}`}
                  label={isBrand ? artist.displayName : "Artist portrait"}
                  sizes={
                    isCompact ? "200px" : "(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
                  }
                />
              ),
            }
          : {})}
        {...(!portraitSrc && artist.workImageUrl
          ? {
              work: (
                <MediaImage
                  src={artist.workImageUrl}
                  alt=""
                  label="Work by this artist"
                  sizes={isCompact ? "200px" : "(max-width: 768px) 50vw, 25vw"}
                />
              ),
            }
          : {})}
        withoutImage="text"
        badges={
          artist.featured || artist.verified || kindBadge ? (
            <>
              {artist.featured ? <Badge>Featured</Badge> : null}
              {artist.verified ? <Badge variant="secondary">Verified</Badge> : null}
              {kindBadge ? (
                <Badge variant="outline" className="bg-surface/90">
                  {kindBadge}
                </Badge>
              ) : null}
            </>
          ) : null
        }
        {...(textOnly ? { action: heart } : { overlayAction: heart })}
      />
    </li>
  );
}
