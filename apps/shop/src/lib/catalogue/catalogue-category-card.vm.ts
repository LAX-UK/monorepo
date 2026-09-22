import type { PublicCategorySummary } from "@auction/shop-contracts";

export type CatalogueCategoryCardVm = {
  id: string;
  image: string | null;
  imageAlt: string;
  label: string;
  href: string;
};

export function buildCatalogueCategoryCards(
  items: PublicCategorySummary[],
): CatalogueCategoryCardVm[] {
  return items.map((item) => ({
    id: `category-${item.slug}`,
    image: item.imageUrl,
    imageAlt: item.label,
    label: item.label,
    href: `/categories/${item.slug}`,
  }));
}
