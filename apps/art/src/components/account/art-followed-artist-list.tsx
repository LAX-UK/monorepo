import { ArtArtistFollowButton } from "@/components/favorites/art-artist-follow-button.client";
import { ArtMediaImage } from "@/components/media/art-media-image";
import type { CatalogueArtistCardVm } from "@/lib/catalogue/catalogue-artist-card.vm";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { ART_MEDIA_LABELS } from "@/lib/media/art-media-labels";
import { MarketingFollowRow } from "@auction/marketing-ui";

/** Followed artists, one row each (Figma 867:15613). */
export function ArtFollowedArtistList({
  cards,
  favoriteAuth,
}: {
  cards: readonly CatalogueArtistCardVm[];
  favoriteAuth: ArtFavoriteAuth;
}) {
  return (
    <ul aria-label="Followed artists" data-testid="art-followed-artists">
      {cards.map((card) => (
        <li key={card.slug}>
          <MarketingFollowRow
            name={card.name}
            href={card.href}
            caption={card.caption}
            avatar={
              card.image ? (
                <ArtMediaImage
                  src={card.image}
                  alt=""
                  label={ART_MEDIA_LABELS.artistPortrait}
                  aspect={[1, 1]}
                  sizes="64px"
                  className="absolute inset-0 size-full"
                  imgClassName="object-cover"
                />
              ) : undefined
            }
            action={
              <ArtArtistFollowButton
                slug={card.slug}
                name={card.name}
                initialFollowing={card.following}
                auth={favoriteAuth}
                followingVariant="secondaryOutline"
                className="min-w-24 px-4 text-sm font-medium normal-case tracking-normal"
              />
            }
          />
        </li>
      ))}
    </ul>
  );
}
