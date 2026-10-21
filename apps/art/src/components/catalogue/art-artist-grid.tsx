import { ArtArtistFollowButton } from "@/components/favorites/art-artist-follow-button.client";
import { ArtMediaImage } from "@/components/media/art-media-image";
import type { CatalogueArtistCardVm } from "@/lib/catalogue/catalogue-artist-card.vm";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { ART_MEDIA_LABELS } from "@/lib/media/art-media-labels";
import { MarketingCardMedia, MarketingCardReveal, MarketingCardShell } from "@auction/marketing-ui";
import Link from "next/link";

export type ArtArtistGridProps = {
  cards: readonly CatalogueArtistCardVm[];
  favoriteAuth: ArtFavoriteAuth;
  "aria-label"?: string;
};

export type ArtArtistCardProps = {
  card: CatalogueArtistCardVm;
  favoriteAuth: ArtFavoriteAuth;
};

/**
 * Figma artist card (`1057:20240`): portrait media, name, life line and an outline Follow.
 * Shared by the artist grid and the home artist rail.
 */
export function ArtArtistCard({ card, favoriteAuth }: ArtArtistCardProps) {
  return (
    <MarketingCardShell
      interactive={false}
      className="flex h-full flex-col rounded-none bg-transparent"
      data-testid="art-artist-card"
    >
      <MarketingCardMedia className="aspect-[8/11] bg-surface-container">
        <Link href={card.href} tabIndex={-1} className="absolute inset-0 block">
          <ArtMediaImage
            src={card.image}
            alt={card.imageAlt}
            label={ART_MEDIA_LABELS.artistPortrait}
            aspect={[8, 11]}
            sizes="(min-width: 64rem) 22vw, (min-width: 48rem) 30vw, 50vw"
            className="absolute inset-0 size-full"
            imgClassName="object-cover"
          />
        </Link>
      </MarketingCardMedia>
      <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 md:pt-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="truncate font-headline text-base font-medium leading-6 text-on-surface md:text-xl md:leading-7">
            <Link href={card.href} className="art-focus-ring rounded-sm hover:underline">
              {card.name}
            </Link>
          </h3>
          {card.caption ? (
            <p className="truncate text-sm text-on-surface-variant md:text-base">{card.caption}</p>
          ) : null}
        </div>
        <div className="shrink-0">
          <ArtArtistFollowButton
            slug={card.slug}
            name={card.name}
            initialFollowing={card.following}
            auth={favoriteAuth}
            className="min-w-20 px-4 text-sm font-medium normal-case tracking-normal"
          />
        </div>
      </div>
    </MarketingCardShell>
  );
}

export function ArtArtistGrid({
  cards,
  favoriteAuth,
  "aria-label": ariaLabel,
}: ArtArtistGridProps) {
  return (
    <ul
      className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6"
      aria-label={ariaLabel}
      data-testid="art-artist-grid"
    >
      {cards.map((card, index) => (
        <li key={card.slug}>
          <MarketingCardReveal index={index}>
            <ArtArtistCard card={card} favoriteAuth={favoriteAuth} />
          </MarketingCardReveal>
        </li>
      ))}
    </ul>
  );
}
