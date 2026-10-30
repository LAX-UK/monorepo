import { ArtArtistFollowButton } from "@/components/favorites/art-artist-follow-button.client";
import { ArtMediaImage } from "@/components/media/art-media-image";
import type { ArtworkArtistVm } from "@/lib/artwork/artwork-detail-page.composer";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { MarketingArrowRightIcon, MarketingArtistSummary } from "@auction/marketing-ui";
import Link from "next/link";

/**
 * "About the artist" on the shared artist summary: portrait (or initials), the artist's facts,
 * one sentence of biography, Follow beside the name and "View artist" under it.
 */
export function ArtArtworkArtistSummary({
  artist,
  favoriteAuth,
}: {
  artist: ArtworkArtistVm;
  favoriteAuth: ArtFavoriteAuth;
}) {
  return (
    <MarketingArtistSummary
      title="About the artist"
      name={artist.name}
      href={artist.href}
      bio={artist.bio}
      meta={artist.facts}
      {...(artist.portraitUrl
        ? {
            avatar: (
              <ArtMediaImage
                src={artist.portraitUrl}
                alt=""
                aspect={[1, 1]}
                sizes="3rem"
                className="absolute inset-0 size-full"
                imgClassName="object-cover"
              />
            ),
          }
        : {})}
      action={
        <ArtArtistFollowButton
          slug={artist.slug}
          name={artist.name}
          initialFollowing={artist.following}
          auth={favoriteAuth}
        />
      }
      actions={
        <Link
          href={artist.href}
          className="art-focus-ring inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-medium text-on-surface underline underline-offset-4 hover:decoration-2"
        >
          View artist
          <span className="sr-only"> {artist.name}</span>
          <MarketingArrowRightIcon className="size-4" />
        </Link>
      }
    />
  );
}
