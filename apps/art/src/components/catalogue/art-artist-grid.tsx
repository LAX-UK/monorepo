import { ArtArtistFollowButton } from "@/components/favorites/art-artist-follow-button.client";
import { ArtMediaImage } from "@/components/media/art-media-image";
import type { CatalogueArtistCardVm } from "@/lib/catalogue/catalogue-artist-card.vm";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { ART_MEDIA_LABELS } from "@/lib/media/art-media-labels";
import { MarketingArtistCard, MarketingArtistGrid } from "@auction/marketing-ui";

export type ArtArtistGridProps = {
  cards: readonly CatalogueArtistCardVm[];
  favoriteAuth: ArtFavoriteAuth;
  "aria-label"?: string;
  /** h2 on the directory, h3 inside a titled section. */
  nameAs?: "h2" | "h3";
};

export type ArtArtistCardProps = {
  card: CatalogueArtistCardVm;
  favoriteAuth: ArtFavoriteAuth;
  nameAs?: "h2" | "h3";
};

/**
 * Artist card: the shared LAX artist card with lax.art's outline Follow. Shared by the
 * directory, the home and Art hub rails and exhibition pages.
 */
export function ArtArtistCard({ card, favoriteAuth, nameAs = "h3" }: ArtArtistCardProps) {
  return (
    <MarketingArtistCard
      href={card.href}
      name={card.name}
      nameAs={nameAs}
      facts={card.caption}
      caption={card.worksLabel}
      {...(card.image
        ? {
            portrait: (
              <ArtMediaImage
                src={card.image}
                alt={card.imageAlt}
                label={ART_MEDIA_LABELS.artistPortrait}
                aspect={[4, 5]}
                sizes="(min-width: 96rem) 20vw, (min-width: 64rem) 25vw, (min-width: 48rem) 30vw, 50vw"
                className="absolute inset-0 size-full"
                imgClassName="object-cover"
              />
            ),
          }
        : {})}
      action={
        <ArtArtistFollowButton
          slug={card.slug}
          name={card.name}
          initialFollowing={card.following}
          auth={favoriteAuth}
          className="min-h-9 min-w-20 px-4 text-sm font-medium normal-case tracking-normal"
        />
      }
    />
  );
}

export function ArtArtistGrid({
  cards,
  favoriteAuth,
  "aria-label": ariaLabel,
  nameAs = "h3",
}: ArtArtistGridProps) {
  return (
    <div data-testid="art-artist-grid">
      <MarketingArtistGrid {...(ariaLabel ? { "aria-label": ariaLabel } : {})}>
        {cards.map((card) => (
          <ArtArtistCard key={card.slug} card={card} favoriteAuth={favoriteAuth} nameAs={nameAs} />
        ))}
      </MarketingArtistGrid>
    </div>
  );
}
