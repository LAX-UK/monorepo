export const BUYER_INTERESTS = [
  {
    key: "art",
    label: "Art",
    categorySlug: "paintings",
    image: "/images/onboarding/interests/art.png",
  },
  {
    key: "watches",
    label: "Watches",
    categorySlug: "watches-clocks",
    image: "/images/onboarding/interests/watches.png",
  },
  {
    key: "jewellery",
    label: "Jewellery",
    categorySlug: "jewellery",
    image: "/images/onboarding/interests/jewellery.png",
  },
  {
    key: "coins",
    label: "Coins & Medals",
    categorySlug: "coins-medals",
    image: "/images/onboarding/interests/coins.png",
  },
  {
    key: "sculpture",
    label: "Sculpture",
    categorySlug: "sculpture",
    image: "/images/onboarding/interests/sculpture.png",
  },
  {
    key: "antiques",
    label: "Antiques",
    categorySlug: "antiques",
    image: "/images/onboarding/interests/antiques.png",
  },
  {
    key: "memorabilia",
    label: "Memorabilia",
    categorySlug: "memorabilia",
    image: "/images/onboarding/interests/memorabilia.png",
  },
  {
    key: "something-else",
    label: "Something else",
    categorySlug: "mixed-media",
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
