import { ArtArtworkCard } from "@/components/catalogue/art-artwork-card";
import type { CatalogueArtworkCardVm } from "@/lib/catalogue/catalogue-artwork-card.vm";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { MarketingCardReveal } from "@auction/marketing-ui";

export type ArtArtworkGridProps = {
  cards: readonly CatalogueArtworkCardVm[];
  favoriteAuth: ArtFavoriteAuth;
  /** Eager-load the first row on above-the-fold grids. */
  priorityCount?: number;
  "aria-label"?: string;
};

export const ART_ARTWORK_GRID_CLASS =
  "grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 xl:grid-cols-4 lg:gap-x-6";

export function ArtArtworkGrid({
  cards,
  favoriteAuth,
  priorityCount = 0,
  "aria-label": ariaLabel,
}: ArtArtworkGridProps) {
  return (
    <ul className={ART_ARTWORK_GRID_CLASS} aria-label={ariaLabel} data-testid="art-artwork-grid">
      {cards.map((card, index) => (
        <li key={card.slug}>
          <MarketingCardReveal index={index}>
            <ArtArtworkCard
              card={card}
              favoriteAuth={favoriteAuth}
              priority={index < priorityCount}
            />
          </MarketingCardReveal>
        </li>
      ))}
    </ul>
  );
}
