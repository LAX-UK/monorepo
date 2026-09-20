/** Uppercase placeholder labels for Shop catalogue media (aligned with Bid upload copy). */
export const SHOP_MEDIA_LABELS = {
  artwork: "Artwork",
  artistPortrait: "Artist portrait",
  category: "Category",
} as const;

export type ShopMediaLabelKey = keyof typeof SHOP_MEDIA_LABELS;
