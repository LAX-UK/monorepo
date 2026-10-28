export type AccentTrack = "buying" | "selling" | "live";

/**
 * Detail-header text is not an accent: back links ("‹ Consignments") and eyebrows use one neutral
 * treatment on every track, at least 4.5:1 on the page in light and dark, in sentence case.
 */
export const BACK_LINK_CLASS =
  "text-on-surface-variant underline-offset-4 hover:text-on-surface hover:underline";

export const EYEBROW_CLASS = "font-label text-xs font-semibold text-on-surface-variant";

export function accentHeroBorderClass(track: AccentTrack = "buying"): string {
  if (track === "selling") return "border-lot-orange/30";
  if (track === "live") return "border-live-red/30";
  return "border-border-hairline";
}
