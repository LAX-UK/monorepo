import { ArtArtistFollowButton } from "@/components/favorites/art-artist-follow-button.client";
import { ArtMediaImage } from "@/components/media/art-media-image";
import type { ArtworkArtistVm } from "@/lib/artwork/artwork-detail-page.composer";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { MarketingArtistSummary } from "@auction/marketing-ui";

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
    />
  );
}
