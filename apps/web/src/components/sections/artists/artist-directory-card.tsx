import { ArtistCardGrid, type ArtistCardGridDensity } from "@/components/marketing/artist-card";
import { ArtistWatchHeart } from "@/components/marketing/artist-watch-heart";
import { MediaImage } from "@/components/ui/media-image";
import { artistKindMeta } from "@/lib/artists/kind-presenter";
import { formatArtistLifespan } from "@/lib/artists/lifespan-presenter";
import type { ArtistProfileLinkContext } from "@/lib/marketing/catalog-links";
import { artistProfileHref } from "@/lib/marketing/catalog-links";
import type { PublicArtistDirectoryRow } from "@auction/types";
import { Badge } from "@auction/ui";
import Link from "next/link";

type Props = {
  artist: PublicArtistDirectoryRow;
  watching: boolean;
  isAuthenticated: boolean;
  profileLinkContext?: ArtistProfileLinkContext;
  density?: ArtistCardGridDensity;
  className?: string;
};

/** Public artist directory card — composes `ArtistCard.Grid`. */
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
  const kindBadge = artist.kind ? artistKindMeta(artist.kind).badge : null;
  const lifespanRaw = formatArtistLifespan({
    birthYear: artist.birthYear,
    deathYear: artist.deathYear,
  });
  const lifespan = lifespanRaw === "—" ? null : lifespanRaw;
  const lotsLabel = artist.lotCount === 1 ? "1 lot" : `${artist.lotCount} lots`;
  const altText = `Portrait of ${artist.displayName}`;
  const isBrand = artist.kind === "brand" || artist.kind === "marque";
  const metaLine = [lifespan, artist.nationality?.trim()].filter(Boolean).join(" · ");

  return (
    <ArtistCardGrid
      href={href}
      aria-label={`View ${artist.displayName}`}
      density={density}
      {...(className ? { className } : {})}
      portraitOverlay={
        <ArtistWatchHeart
          artistId={artist.id}
          artistName={artist.displayName}
          initialWatching={watching}
          isAuthenticated={isAuthenticated}
          loginNextPath={href}
        />
      }
      portrait={
        <MediaImage
          src={artist.portraitUrl ?? artist.heroImageUrl}
          alt={isBrand ? "" : altText}
          label={isBrand ? artist.displayName : "Artist portrait"}
          sizes={isCompact ? "200px" : "(max-width: 768px) 50vw, (max-width: 1024px) 50vw, 25vw"}
        />
      }
      badges={
        <>
          {artist.featured ? <Badge>Featured</Badge> : null}
          {artist.verified ? <Badge variant="secondary">Verified</Badge> : null}
          {!isCompact && kindBadge ? (
            <Badge
              variant="outline"
              className="hidden bg-surface/85 backdrop-blur-sm md:inline-flex"
            >
              {kindBadge}
            </Badge>
          ) : null}
        </>
      }
      title={
        <h2
          className={
            isCompact
              ? "font-headline line-clamp-2 text-sm text-on-surface group-hover:text-primary"
              : "font-headline line-clamp-2 text-base text-on-surface group-hover:text-primary md:text-lg"
          }
        >
          {artist.displayName}
        </h2>
      }
      meta={
        isCompact ? (
          metaLine ? (
            <p className="line-clamp-1 font-body text-xs text-on-surface-variant">{metaLine}</p>
          ) : null
        ) : (
          <p className="hidden font-body text-sm text-on-surface-variant md:block">
            {metaLine || " "}
          </p>
        )
      }
      bio={
        !isCompact && artist.shortBio?.trim() ? (
          <p className="mt-1 hidden line-clamp-2 font-body text-sm text-on-surface-variant md:block">
            {artist.shortBio}
          </p>
        ) : null
      }
      footer={
        <>
          <Link
            href={`${href}#works`}
            className="font-label text-[length:var(--text-label-1)] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline"
            aria-label={`Browse ${lotsLabel} by ${artist.displayName}`}
          >
            {lotsLabel}
          </Link>
          {!isCompact ? (
            <Link
              href={href}
              className="hidden font-label text-[length:var(--text-label-1)] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant hover:text-primary hover:underline sm:inline"
              aria-label={`View profile for ${artist.displayName}`}
            >
              View profile
            </Link>
          ) : null}
        </>
      }
    />
  );
}
