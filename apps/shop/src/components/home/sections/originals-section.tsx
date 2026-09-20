import { OriginalCard } from "@/components/home/cards/original-card";
import { HorizontalRailSection } from "@/components/home/horizontal-rail-section";
import { ShopCatalogueState } from "@/components/home/shop-empty-state";
import type { HomePageViewModel } from "@/lib/home/home-page.vm";

type OriginalsSectionProps = {
  section: HomePageViewModel["sections"]["originals"];
  cards: HomePageViewModel["originals"];
  errorMessage?: string;
};

export function OriginalsSection({ section, cards, errorMessage }: OriginalsSectionProps) {
  return (
    <HorizontalRailSection
      {...section}
      headingId="originals-heading"
      scrollRegionId="originals-rail"
      controlsLabel="Originals carousel"
      forwardAriaLabel="Scroll to see more originals"
      rowClassName="shop-home__scroll-row shop-home__scroll-row--originals"
      emptyState={
        errorMessage ? (
          <ShopCatalogueState
            variant="error"
            title="Originals are temporarily unavailable"
            description="We could not load featured originals. Try again or browse the full catalogue."
            browseHref="/artworks"
            browseLabel="Browse artworks"
          />
        ) : (
          <ShopCatalogueState
            variant="empty"
            title="No originals to show yet"
            description="One-of-a-kind works will appear here when they are published to the shop."
            browseHref="/artworks"
            browseLabel="Browse artworks"
            showRetry={false}
          />
        )
      }
    >
      {cards.map((card) => (
        <OriginalCard key={card.id} card={card} />
      ))}
    </HorizontalRailSection>
  );
}
