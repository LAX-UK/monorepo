import { ShopEditionCard } from "@/components/catalogue/shop-edition-card";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import { buildEditionCards } from "@/lib/catalogue/edition-card.vm";
import { MarketingWorkGrid } from "@auction/marketing-ui";
import type { PublicArtworkSummary } from "@auction/shop-contracts";

type CatalogueGridProps = {
  items: readonly PublicArtworkSummary[];
  /** Card titles are h2 on a listing page, h3 inside a titled section. */
  titleLevel?: 2 | 3;
  /** Leave out the artist line, e.g. on the artist's own page. */
  hideArtist?: boolean;
  /** How many cards at the top load their image first. */
  priorityCount?: number;
  /** "Now" for the new-release rule; injectable for tests. */
  now?: Date;
  "aria-label"?: string;
  className?: string;
};

/** Shop editions in the shared LAX works grid, each as the Shop product card. */
export function CatalogueGrid({
  items,
  titleLevel = 2,
  hideArtist = false,
  priorityCount = 0,
  now = new Date(),
  "aria-label": ariaLabel,
  className,
}: CatalogueGridProps) {
  if (items.length === 0) {
    return (
      <ShopStatusState
        variant="empty"
        title="No artworks found"
        description="There are no published works in this collection yet. Explore artists or categories in the meantime."
        actions={
          <>
            <ShopStatusStateLink href="/artists">Browse artists</ShopStatusStateLink>
            <ShopStatusStateLink href="/categories">Browse categories</ShopStatusStateLink>
          </>
        }
      />
    );
  }

  return (
    <MarketingWorkGrid
      className={className ? `shop-edition-grid ${className}` : "shop-edition-grid"}
      {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
    >
      {buildEditionCards(items, now).map((card, index) => (
        <ShopEditionCard
          key={card.slug}
          card={card}
          titleAs={titleLevel === 3 ? "h3" : "h2"}
          hideArtist={hideArtist}
          priority={index < priorityCount}
        />
      ))}
    </MarketingWorkGrid>
  );
}
