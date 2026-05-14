import { ArtistWatchHeart } from "@/components/marketing/artist-watch-heart";
import { artistKindMeta } from "@/lib/artists/kind-presenter";
import { formatArtistLifespan } from "@/lib/artists/lifespan-presenter";
import { artistPath } from "@/lib/seo/url";
import type { PublicArtistDirectoryRow } from "@auction/types";
import { Badge } from "@auction/ui";
import Image from "next/image";
import Link from "next/link";

type Props = {
  artist: PublicArtistDirectoryRow;
  watching: boolean;
  isAuthenticated: boolean;
};

/** Public artist directory card. Server-rendered shell + a single client island
 * for the watchlist toggle so the grid stays cheap to hydrate. */
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
    <li className="group relative flex flex-col overflow-hidden rounded-xl border border-outline-variant/15 bg-surface shadow-sm transition hover:border-primary/40 hover:shadow-md">
      <div className="absolute right-3 top-3 z-10">
        <ArtistWatchHeart
          artistId={artist.id}
          artistName={artist.displayName}
          initialWatching={watching}
          isAuthenticated={isAuthenticated}
          loginNextPath={href}
        />
      </div>
      <Link
        href={href}
        className="flex flex-1 flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        aria-label={`View ${artist.displayName}`}
      >
        <div className="relative aspect-[4/5] bg-surface-container-low">
          {artist.portraitUrl ? (
            <Image
              src={artist.portraitUrl}
              alt={isBrand ? "" : altText}
              fill
              className="object-cover transition duration-500 group-hover:scale-[1.02]"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          ) : (
            <div
              className="flex h-full items-center justify-center font-headline text-5xl text-on-surface-variant/30"
              aria-hidden
            >
              {artist.displayName.slice(0, 1)}
            </div>
          )}
          <div className="absolute left-3 top-3 flex flex-wrap gap-1">
            {artist.featured ? <Badge>Featured</Badge> : null}
            {artist.verified ? <Badge variant="secondary">Verified</Badge> : null}
            {kindBadge ? (
              <Badge variant="outline" className="bg-surface/85 backdrop-blur-sm">
                {kindBadge}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-1 p-4">
          <h2 className="font-headline text-lg text-on-surface group-hover:text-primary">
            {artist.displayName}
          </h2>
          <p className="font-body text-sm text-on-surface-variant">
            {[lifespan, artist.nationality?.trim()].filter(Boolean).join(" · ") || " "}
          </p>
          {artist.shortBio?.trim() ? (
            <p className="mt-1 line-clamp-2 font-body text-sm text-on-surface-variant">
              {artist.shortBio}
            </p>
          ) : null}
        </div>
      </Link>
      <div className="flex items-center justify-between gap-3 border-t border-outline-variant/15 px-4 py-3">
        <Link
          href={`${href}#works`}
          className="font-label text-[10px] uppercase tracking-widest text-primary hover:underline"
          aria-label={`Browse ${lotsLabel} by ${artist.displayName}`}
        >
          {lotsLabel}
        </Link>
        <Link
          href={href}
          className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant hover:text-primary hover:underline"
          aria-label={`View profile for ${artist.displayName}`}
        >
          View profile
        </Link>
      </div>
    </li>
  );
}
