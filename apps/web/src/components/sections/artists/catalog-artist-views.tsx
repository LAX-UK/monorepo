import { ArtistWatchHeart } from "@/components/marketing/artist-watch-heart";
import { ArtistDirectoryCard } from "@/components/sections/artists/artist-directory-card";
import { MediaImage } from "@/components/ui/media-image";
import { artistKindMeta } from "@/lib/artists/kind-presenter";
import { formatArtistLifespan } from "@/lib/artists/lifespan-presenter";
import type { ArtistProfileLinkContext } from "@/lib/marketing/catalog-links";
import { artistProfileHref } from "@/lib/marketing/catalog-links";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import { sparseGridClasses } from "@/lib/ui/sparse-grid-classes";
import type { PublicArtistDirectoryRow } from "@auction/types";
import { Badge } from "@auction/ui";
import { cn } from "@auction/ui";
import Link from "next/link";

export function ArtistBrowseGrid({
  rows,
  watchSet,
  isAuthenticated,
  profileLinkContext,
}: {
  rows: PublicArtistDirectoryRow[];
  watchSet: ReadonlySet<string>;
  isAuthenticated: boolean;
  profileLinkContext?: ArtistProfileLinkContext;
}) {
  return (
    <ul
      className={cn(
        "gap-3 md:gap-6",
        sparseGridClasses(rows.length, {
          multi: "grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-2 md:gap-6 xl:grid-cols-3",
        }),
      )}
    >
      {rows.map((a) => (
        <ArtistDirectoryCard
          key={a.id}
          artist={a}
          watching={watchSet.has(a.id)}
          isAuthenticated={isAuthenticated}
          {...(profileLinkContext ? { profileLinkContext } : {})}
        />
      ))}
    </ul>
  );
}

/** Profile-page horizontal rail — compact directory cards for related artists. */
export function ArtistRelatedBrowseRail({
  rows,
  watchSet,
  isAuthenticated,
  profileLinkContext,
}: {
  rows: PublicArtistDirectoryRow[];
  watchSet: ReadonlySet<string>;
  isAuthenticated: boolean;
  profileLinkContext?: ArtistProfileLinkContext;
}) {
  return (
    <ul className="m-0 flex list-none snap-x snap-mandatory gap-4 overflow-x-auto p-0 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {rows.map((a) => (
        <ArtistDirectoryCard
          key={a.id}
          artist={a}
          watching={watchSet.has(a.id)}
          isAuthenticated={isAuthenticated}
          density="compact"
          className="w-[180px] shrink-0 snap-start sm:w-[200px]"
          {...(profileLinkContext ? { profileLinkContext } : {})}
        />
      ))}
    </ul>
  );
}

/** Feature-style cards: large portrait, bio, distinct from grid tiles. */
export function ArtistBrowseCard({
  rows,
  watchSet,
  isAuthenticated,
  profileLinkContext,
}: {
  rows: PublicArtistDirectoryRow[];
  watchSet: ReadonlySet<string>;
  isAuthenticated: boolean;
  profileLinkContext?: ArtistProfileLinkContext;
}) {
  return (
    <ul className="mx-auto grid max-w-4xl list-none gap-8 p-0 lg:max-w-none lg:grid-cols-2 lg:gap-10">
      {rows.map((artist) => {
        const href = artistProfileHref(
          { id: artist.id, name: artist.displayName },
          profileLinkContext,
        );
        const kindBadge = artist.kind ? artistKindMeta(artist.kind).badge : null;
        const lifespanRaw = formatArtistLifespan({
          birthYear: artist.birthYear,
          deathYear: artist.deathYear,
        });
        const lifespan = lifespanRaw === "—" ? null : lifespanRaw;
        const lotsLabel = artist.lotCount === 1 ? "1 lot" : `${artist.lotCount} lots`;
        const altText = `Portrait of ${artist.displayName}`;
        const isBrand = artist.kind === "brand" || artist.kind === "marque";
        const heroAspect = isBrand ? "aspect-[2/3]" : "aspect-video";

        return (
          <li
            key={artist.id}
            className="group relative list-none overflow-hidden rounded-xl border border-border-hairline bg-surface transition-[transform,border-color] duration-[var(--motion-duration-md)] motion-reduce:transition-none hover:-translate-y-px hover:border-primary/40"
          >
            <Link
              href={href}
              className={cn("block rounded-xl", FOCUS_RING)}
              aria-label={`View ${artist.displayName}`}
            >
              <div className={cn("relative overflow-hidden bg-surface-container-low", heroAspect)}>
                <MediaImage
                  src={artist.portraitUrl}
                  alt={isBrand ? "" : altText}
                  label={isBrand ? artist.displayName : "Artist portrait"}
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  imgClassName="transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.02] motion-reduce:group-hover:scale-100"
                />
                <div className="absolute left-3 top-3 flex flex-wrap gap-1">
                  {artist.featured ? <Badge>Featured</Badge> : null}
                  {artist.verified ? <Badge variant="secondary">Verified</Badge> : null}
                  {kindBadge ? (
                    <Badge variant="outline" className="bg-surface/85 backdrop-blur-sm">
                      {kindBadge}
                    </Badge>
                  ) : null}
                </div>
                <div className="pointer-events-auto absolute bottom-3 right-3 z-10">
                  <ArtistWatchHeart
                    artistId={artist.id}
                    artistName={artist.displayName}
                    initialWatching={watchSet.has(artist.id)}
                    isAuthenticated={isAuthenticated}
                    loginNextPath={href}
                  />
                </div>
              </div>
              <div className="space-y-2 p-5">
                <h2 className="font-headline text-xl font-semibold leading-tight text-on-surface group-hover:text-primary">
                  {artist.displayName}
                </h2>
                <p className="text-sm text-on-surface-variant">
                  {[lifespan, artist.nationality?.trim()].filter(Boolean).join(" · ") || "\u00a0"}
                </p>
                {artist.shortBio?.trim() ? (
                  <p className="line-clamp-3 text-sm leading-relaxed text-on-surface-variant">
                    {artist.shortBio}
                  </p>
                ) : null}
              </div>
            </Link>
            <div className="flex items-center justify-between gap-3 border-t border-border-hairline px-5 py-3">
              <Link
                href={`${href}#works`}
                className={cn(
                  "rounded-sm font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline",
                  FOCUS_RING,
                )}
                aria-label={`Browse ${lotsLabel} by ${artist.displayName}`}
              >
                {lotsLabel}
              </Link>
              <Link
                href={href}
                className={cn(
                  "rounded-sm font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant hover:text-primary hover:underline",
                  FOCUS_RING,
                )}
              >
                View profile
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ArtistBrowseList({
  rows,
  watchSet,
  isAuthenticated,
  profileLinkContext,
}: {
  rows: PublicArtistDirectoryRow[];
  watchSet: ReadonlySet<string>;
  isAuthenticated: boolean;
  profileLinkContext?: ArtistProfileLinkContext;
}) {
  return (
    <ul className="divide-y divide-outline-variant/15 rounded-xl border border-border-hairline bg-surface-container-lowest">
      {rows.map((a) => {
        const href = artistProfileHref({ id: a.id, name: a.displayName }, profileLinkContext);
        return (
          <li key={a.id} className="relative">
            <div className="absolute right-3 top-1/2 z-10 -translate-y-1/2">
              <ArtistWatchHeart
                artistId={a.id}
                artistName={a.displayName}
                initialWatching={watchSet.has(a.id)}
                isAuthenticated={isAuthenticated}
                loginNextPath={href}
              />
            </div>
            <Link
              href={href}
              className={cn(
                "flex items-center gap-4 rounded-md p-4 pr-12 transition-colors hover:bg-surface-container-low/50 sm:px-5 sm:pr-14",
                FOCUS_RING,
              )}
            >
              <span className="relative size-12 shrink-0 overflow-hidden rounded-full bg-surface-container-low">
                <MediaImage
                  src={a.portraitUrl}
                  alt={`Portrait of ${a.displayName}`}
                  label={a.displayName.slice(0, 1).toUpperCase()}
                  shape="circle"
                  sizes="48px"
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-headline text-base text-on-surface sm:text-lg">
                  {a.displayName}
                </p>
                {a.shortBio ? (
                  <p className="mt-0.5 line-clamp-2 text-sm text-on-surface-variant">
                    {a.shortBio}
                  </p>
                ) : null}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
