import { ArtistCardGrid } from "@/components/marketing/artist-card";
import { ArtistWatchHeart } from "@/components/marketing/artist-watch-heart";
import { MediaImage } from "@/components/ui/media-image";
import { artistKindMeta } from "@/lib/artists/kind-presenter";
import { formatArtistLifespan } from "@/lib/artists/lifespan-presenter";
import { artistPath } from "@/lib/seo/url";
import type { PublicArtistDirectoryRow } from "@auction/types";
import { Badge } from "@auction/ui";
import Link from "next/link";

type Props = {
  artist: PublicArtistDirectoryRow;
  watching: boolean;
  isAuthenticated: boolean;
};

/** Public artist directory card — composes `ArtistCard.Grid`. */
export function ArtistDirectoryCard({ artist, watching, isAuthenticated }: Props) {
  const href = artistPath({ id: artist.id, name: artist.displayName });
  const kindBadge = artist.kind ? artistKindMeta(artist.kind).badge : null;
  const lifespanRaw = formatArtistLifespan({
    birthYear: artist.birthYear,
    deathYear: artist.deathYear,
  });
  const lifespan = lifespanRaw === "—" ? null : lifespanRaw;
  const lotsLabel = artist.lotCount === 1 ? "1 lot" : `${artist.lotCount} lots`;
  const altText = `Portrait of ${artist.displayName}`;
  const isBrand = artist.kind === "brand" || artist.kind === "marque";

  return (
    <ArtistCardGrid
      href={href}
      aria-label={`View ${artist.displayName}`}
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
          src={artist.portraitUrl}
          alt={isBrand ? "" : altText}
          label={isBrand ? artist.displayName : "Artist portrait"}
          sizes="(max-width: 768px) 50vw, (max-width: 1024px) 50vw, 25vw"
        />
      }
      badges={
        <>
          {artist.featured ? <Badge>Featured</Badge> : null}
          {artist.verified ? <Badge variant="secondary">Verified</Badge> : null}
          {kindBadge ? (
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
        <h2 className="font-headline line-clamp-2 text-base text-on-surface group-hover:text-primary md:text-lg">
          {artist.displayName}
        </h2>
      }
      meta={
        <p className="hidden font-body text-sm text-on-surface-variant md:block">
          {[lifespan, artist.nationality?.trim()].filter(Boolean).join(" · ") || " "}
        </p>
      }
      bio={
        artist.shortBio?.trim() ? (
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
          <Link
            href={href}
            className="hidden font-label text-[length:var(--text-label-1)] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant hover:text-primary hover:underline sm:inline"
            aria-label={`View profile for ${artist.displayName}`}
          >
            View profile
          </Link>
        </>
      }
    />
  );
}
