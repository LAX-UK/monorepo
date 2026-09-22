import type { HomeCategoryCard } from "@/content/home-marketing";
import { buildCatalogueCategoryCards } from "@/lib/catalogue/catalogue-category-card.vm";
import type { PublicCategorySummary } from "@auction/shop-contracts";

export function buildCategoryRailCards(items: PublicCategorySummary[]): HomeCategoryCard[] {
  return buildCatalogueCategoryCards(items);
}
