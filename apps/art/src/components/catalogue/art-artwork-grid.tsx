import { ArtArtworkCard } from "@/components/catalogue/art-artwork-card";
import type { CatalogueArtworkCardVm } from "@/lib/catalogue/catalogue-artwork-card.vm";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { MARKETING_WORK_GRID_CLASS, MarketingCardReveal } from "@auction/marketing-ui";
import { cn } from "@auction/ui";

export type ArtArtworkGridProps = {
  cards: readonly CatalogueArtworkCardVm[];
  favoriteAuth: ArtFavoriteAuth;
  /** Eager-load the first row on above-the-fold grids. */
  priorityCount?: number;
  "aria-label"?: string;
  /** Extra grid classes, e.g. a row of three for exactly three works. */
  className?: string;
};

/** The shared LAX works grid, so lax.art, Shop and Bid lay works out the same way. */
export const ART_ARTWORK_GRID_CLASS = MARKETING_WORK_GRID_CLASS;

export function ArtArtworkGrid({
  cards,
  favoriteAuth,
  priorityCount = 0,
  "aria-label": ariaLabel,
  className,
}: ArtArtworkGridProps) {
  return (
    <ul
      className={cn(ART_ARTWORK_GRID_CLASS, className)}
      aria-label={ariaLabel}
      data-testid="art-artwork-grid"
    >
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
