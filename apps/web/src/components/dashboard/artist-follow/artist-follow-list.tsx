"use client";

import { DashboardListRowCard } from "@/components/dashboard/primitives/dashboard-list-row-card";
import { ArtistWatchHeart } from "@/components/marketing/artist-watch-heart";
import { initials } from "@/components/organisations/initials";
import { MediaImage } from "@/components/ui/media-image";
import { useDashboardListRowPaddingClass } from "@/hooks/use-dashboard-list-density";
import { formatArtistLifespan } from "@/lib/artists/lifespan-presenter";
import type { ArtistFollowCardVm } from "@/lib/data/artist-follow-card.vm";
import { artistPath } from "@/lib/seo/url";
import { formatRelativeTime } from "@/lib/ui/format";
import { cn } from "@auction/ui";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  artist: ArtistFollowCardVm;
  variant?: "list" | "grid";
};

function formatArtistMeta(artist: ArtistFollowCardVm): string | null {
  const lifespan = formatArtistLifespan({
    birthYear: artist.birthYear,
    deathYear: artist.deathYear,
  });
  const parts: string[] = [];
  if (lifespan !== "—") parts.push(lifespan);
  if (artist.nationality) parts.push(artist.nationality);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function ArtistPortrait({
  artist,
  variant,
  className,
}: {
  artist: ArtistFollowCardVm;
  variant: "list" | "grid";
  className?: string;
}) {
  const isBrand = artist.kind === "brand" || artist.kind === "marque";
  const alt = isBrand ? "" : `Portrait of ${artist.displayName}`;

  if (variant === "grid") {
    return (
      <span
        className={cn(
          "relative block shrink-0 overflow-hidden rounded-lg bg-surface-container-low ring-1 ring-border-hairline",
          "aspect-[4/5] w-20 sm:w-24",
          className,
        )}
      >
        <MediaImage
          src={artist.portraitUrl}
          alt={alt}
          label={initials(artist.displayName)}
          shape="rect"
          sizes="(max-width: 1024px) 80px, 96px"
          className="size-full"
          imgClassName="object-cover"
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full bg-surface-container-low ring-1 ring-border-hairline",
        className,
      )}
    >
      <MediaImage
        src={artist.portraitUrl}
        alt={alt}
        label={initials(artist.displayName)}
        shape="circle"
        sizes="56px"
        className="size-full"
      />
    </span>
  );
}

function ArtistFollowCardBody({
  artist,
  profileHref,
  meta,
  followedLabel,
}: {
  artist: ArtistFollowCardVm;
  profileHref: string;
  meta: string | null;
  followedLabel: string;
}) {
  return (
    <div className="min-w-0 flex-1">
      <Link
        href={profileHref}
        className="block truncate font-headline text-sm font-semibold text-on-surface underline-offset-4 hover:underline sm:text-base"
      >
        {artist.displayName}
      </Link>
      {meta ? <p className="mt-0.5 truncate text-xs text-on-surface-variant">{meta}</p> : null}
      {artist.shortBio ? (
        <p className="mt-1 line-clamp-2 text-xs text-on-surface-variant sm:text-sm">
          {artist.shortBio}
        </p>
      ) : null}
      <p className="mt-1.5 font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant/80">
        {followedLabel}
      </p>
    </div>
  );
}

/** Single followed-artist card with portrait, meta, and heart unfollow. */
export function ArtistFollowCard({ artist, variant = "grid" }: Props) {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rowPadding = useDashboardListRowPaddingClass();

  const profileHref = artistPath({ id: artist.artistId, name: artist.displayName });
  const meta = formatArtistMeta(artist);
  const followedLabel = `Followed ${formatRelativeTime(artist.followedAtMs)}`;

  if (hidden) return null;

  const heart = (
    <ArtistWatchHeart
      artistId={artist.artistId}
      artistName={artist.displayName}
      initialWatching
      isAuthenticated
      loginNextPath={profileHref}
      surface="inline"
      onWatchingChange={(watching, ok) => {
        if (!watching && ok) {
          setHidden(true);
          router.refresh();
          return;
        }
        if (!ok) {
          setError("Could not unfollow. Try again in a moment.");
        }
      }}
    />
  );

  if (variant === "list") {
    return (
      <>
        <DashboardListRowCard
          className={cn("border-border-hairline", rowPadding)}
          thumbnail={<ArtistPortrait artist={artist} variant="list" className="size-14" />}
          title={
            <Link
              href={profileHref}
              className="block truncate font-headline text-sm font-semibold text-on-surface underline-offset-4 hover:underline"
            >
              {artist.displayName}
            </Link>
          }
          subtitle={
            <>
              {meta ? <p className="truncate text-xs text-on-surface-variant">{meta}</p> : null}
              {artist.shortBio ? (
                <p className="mt-1 line-clamp-2 text-xs text-on-surface-variant">
                  {artist.shortBio}
                </p>
              ) : null}
              <p className="mt-1 font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant/80">
                {followedLabel}
              </p>
            </>
          }
          trailing={heart}
        />
        {error ? (
          <p className="mt-2 text-xs text-error" role="alert">
            {error}
          </p>
        ) : null}
      </>
    );
  }

  return (
    <Surface
      variant="section"
      padding="md"
      interactive
      aria-label={`${artist.displayName}, followed artist`}
      className="relative border-border-hairline shadow-sm transition hover:border-link/25 hover:shadow-md"
    >
      <div className="flex gap-3">
        <Link
          href={profileHref}
          className="shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ArtistPortrait artist={artist} variant="grid" />
        </Link>
        <div className="min-w-0 flex-1 pr-10">
          <ArtistFollowCardBody
            artist={artist}
            profileHref={profileHref}
            meta={meta}
            followedLabel={followedLabel}
          />
        </div>
        <div className="absolute right-3 top-3">{heart}</div>
      </div>
      {error ? (
        <p className="mt-3 text-xs text-error" role="alert">
          {error}
        </p>
      ) : null}
    </Surface>
  );
}

type ListProps = {
  artists: ArtistFollowCardVm[];
};

/** Responsive followed-artists list — mobile rows, desktop grid. */
export function ArtistFollowList({ artists }: ListProps) {
  return (
    <>
      <div className="lg:hidden">
        <ul className="list-none space-y-3" aria-label="Followed artists">
          {artists.map((artist) => (
            <li key={artist.watchlistId}>
              <ArtistFollowCard artist={artist} variant="list" />
            </li>
          ))}
        </ul>
      </div>
      <ul className="hidden list-none gap-4 lg:grid lg:grid-cols-2" aria-label="Followed artists">
        {artists.map((artist) => (
          <li key={artist.watchlistId}>
            <ArtistFollowCard artist={artist} variant="grid" />
          </li>
        ))}
      </ul>
    </>
  );
}
