import { CategoryCard } from "@/components/home/cards/category-card";
import { HorizontalRailSection } from "@/components/home/horizontal-rail-section";
import { ShopCatalogueState } from "@/components/home/shop-empty-state";
import type { HomePageViewModel } from "@/lib/home/home-page.vm";

type CategoriesSectionProps = {
  section: HomePageViewModel["sections"]["categories"];
  cards: HomePageViewModel["categories"];
  errorMessage?: string;
};

export function CategoriesSection({ section, cards, errorMessage }: CategoriesSectionProps) {
  return (
    <HorizontalRailSection
      {...section}
      headingId="categories-heading"
      scrollRegionId="categories-rail"
      controlsLabel="Categories carousel"
      forwardAriaLabel="Scroll to see more categories"
      rowClassName="shop-home__scroll-row shop-home__scroll-row--categories"
      emptyState={
        errorMessage ? (
          <ShopCatalogueState
            variant="error"
            title="Categories are temporarily unavailable"
            description="We could not load curated categories. Try again or open the categories index."
            browseHref="/categories"
            browseLabel="Browse categories"
          />
        ) : (
          <ShopCatalogueState
            variant="empty"
            title="No categories to show yet"
            description="Curated categories will appear here when they are published."
            browseHref="/categories"
            browseLabel="Browse categories"
            showRetry={false}
          />
        )
      }
    >
      {cards.map((card) => (
        <CategoryCard key={card.id} card={card} />
      ))}
    </HorizontalRailSection>
  );
}
