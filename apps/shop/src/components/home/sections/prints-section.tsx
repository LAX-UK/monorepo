import { PrintCard } from "@/components/home/cards/print-card";
import { HorizontalRailSection } from "@/components/home/horizontal-rail-section";
import { ShopCatalogueState } from "@/components/home/shop-empty-state";
import type { HomePageViewModel } from "@/lib/home/home-page.vm";

type PrintsSectionProps = {
  section: HomePageViewModel["sections"]["prints"];
  cards: HomePageViewModel["printCards"];
  errorMessage?: string;
};

export function PrintsSection({ section, cards, errorMessage }: PrintsSectionProps) {
  return (
    <HorizontalRailSection
      {...section}
      sectionId="shop-prints"
      headingId="prints-heading"
      scrollRegionId="prints-rail"
      controlsLabel="Prints and multiples carousel"
      forwardAriaLabel="Scroll to see more prints and multiples"
      rowClassName="shop-home__scroll-row shop-home__scroll-row--prints"
      emptyState={
        errorMessage ? (
          <ShopCatalogueState
            variant="error"
            title="Prints are temporarily unavailable"
            description="We could not load featured prints. Try again or browse available editions."
            browseHref="/artworks"
            browseLabel="Browse artworks"
          />
        ) : (
          <ShopCatalogueState
            variant="empty"
            title="No prints to show yet"
            description="New editions and multiples will appear here when they are published."
            browseHref="/artworks"
            browseLabel="Browse artworks"
            showRetry={false}
          />
        )
      }
    >
      {cards.map((card) => (
        <PrintCard key={card.id} card={card} />
      ))}
    </HorizontalRailSection>
  );
}
