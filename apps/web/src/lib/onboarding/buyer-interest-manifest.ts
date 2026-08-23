import { BUYER_INTEREST_CATEGORY_SEEDS } from "@auction/validators";

export const BUYER_INTERESTS = [
  {
    key: "art",
    label: "Art",
    categorySlug: BUYER_INTEREST_CATEGORY_SEEDS.art.slug,
    image: "/images/onboarding/interests/art.png",
  },
  {
    key: "watches",
    label: "Watches",
    categorySlug: BUYER_INTEREST_CATEGORY_SEEDS.watches.slug,
    image: "/images/onboarding/interests/watches.png",
  },
  {
    key: "jewellery",
    label: "Jewellery",
    categorySlug: BUYER_INTEREST_CATEGORY_SEEDS.jewellery.slug,
    image: "/images/onboarding/interests/jewellery.png",
  },
  {
    key: "coins",
    label: "Coins & Medals",
    categorySlug: BUYER_INTEREST_CATEGORY_SEEDS.coins.slug,
    image: "/images/onboarding/interests/coins.png",
  },
  {
    key: "sculpture",
    label: "Sculpture",
    categorySlug: BUYER_INTEREST_CATEGORY_SEEDS.sculpture.slug,
    image: "/images/onboarding/interests/sculpture.png",
  },
  {
    key: "antiques",
    label: "Antiques",
    categorySlug: BUYER_INTEREST_CATEGORY_SEEDS.antiques.slug,
    image: "/images/onboarding/interests/antiques.png",
  },
  {
    key: "memorabilia",
    label: "Memorabilia",
    categorySlug: BUYER_INTEREST_CATEGORY_SEEDS.memorabilia.slug,
    image: "/images/onboarding/interests/memorabilia.png",
  },
  {
    key: "something-else",
    label: "Something else",
    categorySlug: BUYER_INTEREST_CATEGORY_SEEDS["something-else"].slug,
    image: "/images/onboarding/interests/something-else.png",
    excludeFromRecommendations: true,
  },
] as const;

export type BuyerInterestKey = (typeof BUYER_INTERESTS)[number]["key"];

export function recommendationCategorySlugs(selectedKeys: readonly BuyerInterestKey[]): string[] {
  const selected = new Set(selectedKeys);
  return BUYER_INTERESTS.filter(
    (interest) => selected.has(interest.key) && !("excludeFromRecommendations" in interest),
  ).map((interest) => interest.categorySlug);
}
