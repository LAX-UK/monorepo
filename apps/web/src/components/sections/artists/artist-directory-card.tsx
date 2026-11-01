import { ArtistPortraitFrame } from "@/components/marketing/artist-portrait-frame";
import { ArtistWatchHeart } from "@/components/marketing/artist-watch-heart";
import { artistKindMeta } from "@/lib/artists/kind-presenter";
import type { ArtistProfileLinkContext } from "@/lib/marketing/catalog-links";
import { artistProfileHref } from "@/lib/marketing/catalog-links";
import { MarketingArtistCard, marketingArtistFactsLine } from "@auction/marketing-ui";
import type { PublicArtistDirectoryRow } from "@auction/types";
import { cn } from "@auction/ui";
import { StatusBadge } from "@auction/ui/lax";

type Props = {
  artist: PublicArtistDirectoryRow;
  watching: boolean;
  isAuthenticated: boolean;
  profileLinkContext?: ArtistProfileLinkContext;
  density?: "default" | "compact";
  className?: string;
};

/** "1 lot", "12 lots"; null when the artist has none. */
export function artistLotCountLabel(lotCount: number): string | null {
  if (lotCount <= 0) return null;
  return `${lotCount} ${lotCount === 1 ? "lot" : "lots"}`;
}

/** Public artist directory card: the shared `MarketingArtistCard` with Bid's watch heart. */
export function ArtistDirectoryCard({
  artist,
  watching,
  isAuthenticated,
  profileLinkContext,
  density = "default",
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

  return (
    <li className={cn("min-w-0", className)}>
      <MarketingArtistCard
        href={href}
        name={artist.displayName}
        nameAs={isCompact ? "h3" : "h2"}
        density={density}
        facts={marketingArtistFactsLine({
          nationality: artist.nationality,
          birthYear: artist.birthYear,
          deathYear: artist.deathYear,
        })}
        caption={artistLotCountLabel(artist.lotCount)}
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
        badges={
          artist.featured || artist.verified || kindBadge ? (
            <>
              {artist.featured ? <StatusBadge tone="info">Featured</StatusBadge> : null}
              {artist.verified ? <StatusBadge tone="success">Verified</StatusBadge> : null}
              {kindBadge ? (
                <StatusBadge tone="neutral" onImage>
                  {kindBadge}
                </StatusBadge>
              ) : null}
            </>
          ) : null
        }
        overlayAction={
          <ArtistWatchHeart
            artistId={artist.id}
            artistName={artist.displayName}
            initialWatching={watching}
            isAuthenticated={isAuthenticated}
            loginNextPath={href}
          />
        }
      />
    </li>
  );
}
