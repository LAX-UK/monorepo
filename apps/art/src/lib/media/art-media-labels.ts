/** Uppercase placeholder labels for lax.art catalogue media (aligned with Bid upload copy). */
export const ART_MEDIA_LABELS = {
  artwork: "Artwork",
  artistPortrait: "Artist portrait",
  category: "Category",
} as const;

export type ArtMediaLabelKey = keyof typeof ART_MEDIA_LABELS;
