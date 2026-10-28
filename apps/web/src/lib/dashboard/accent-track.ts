export type AccentTrack = "buying" | "selling" | "live";

export function accentEyebrowClass(track: AccentTrack = "buying"): string {
  if (track === "selling") return "text-lot-orange";
  if (track === "live") return "text-live-red";
  return "text-accent-buying";
}

/**
 * Back links ("‹ Consignments") are navigation, not an accent: one neutral treatment on every
 * track, at least 4.5:1 on the page in light and dark.
 */
export const BACK_LINK_CLASS =
  "text-on-surface-variant underline-offset-4 hover:text-on-surface hover:underline";

export function accentHeroBorderClass(track: AccentTrack = "buying"): string {
  if (track === "selling") return "border-lot-orange/30";
  if (track === "live") return "border-live-red/30";
  return "border-border-hairline";
}
