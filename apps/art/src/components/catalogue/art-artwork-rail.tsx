import { ArtArtworkCard } from "@/components/catalogue/art-artwork-card";
import { ArtRail, ArtRailItem } from "@/components/layout/art-rail";
import type { CatalogueArtworkCardVm } from "@/lib/catalogue/catalogue-artwork-card.vm";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";

export type ArtArtworkRailProps = {
  id: string;
  label: string;
  cards: readonly CatalogueArtworkCardVm[];
  favoriteAuth: ArtFavoriteAuth;
};

export function ArtArtworkRail({ id, label, cards, favoriteAuth }: ArtArtworkRailProps) {
  return (
    <ArtRail id={id} label={label}>
      {cards.map((card) => (
        <ArtRailItem key={card.slug}>
          <ArtArtworkCard card={card} favoriteAuth={favoriteAuth} />
        </ArtRailItem>
      ))}
    </ArtRail>
  );
}
