/**
 * Band surfaces for promo and CTA sections. A product theme may define
 * `--color-surface-feature` / `--color-surface-inverse` and their `on-` pairs;
 * the fallbacks keep themes without them on their existing surface tokens.
 */
export type MarketingSurfaceTone = "feature" | "plain" | "inverse";

export const MARKETING_SURFACE_TONE: Record<
  MarketingSurfaceTone,
  { surface: string; body: string }
> = {
  feature: {
    surface:
      "bg-[var(--color-surface-feature,var(--color-surface-container-low))] text-[var(--color-on-surface-feature,var(--color-on-surface))]",
    body: "text-on-surface-variant",
  },
  plain: {
    surface: "bg-surface text-on-surface",
    body: "text-on-surface-variant",
  },
  inverse: {
    surface:
      "bg-[var(--color-surface-inverse,var(--color-on-surface))] text-[var(--color-on-surface-inverse,var(--color-surface))]",
    // The variant text token is tuned for the page surface, not its inverse, so body copy inherits.
    body: "opacity-85",
  },
};
