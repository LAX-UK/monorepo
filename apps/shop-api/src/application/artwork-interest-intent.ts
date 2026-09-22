export type ArtworkInterestIntent = "notify_me" | "enquiry";

export function normalizeArtworkInterestIntent(
  intent: ArtworkInterestIntent | undefined,
): ArtworkInterestIntent {
  return intent ?? "notify_me";
}
