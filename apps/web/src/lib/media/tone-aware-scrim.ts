import type { OverlayTone } from "./overlay-tone-types";

/** Gradient stop tokens for hero scrims — uses existing @theme scrim vars only. */
export type ScrimStops = {
  strong: string;
  mid: string;
  soft: string;
};

/** Pick scrim token stops tuned to resolved overlay tone (photo-aware, not site theme). */
export function toneAwareScrimStops(tone: OverlayTone): ScrimStops {
  if (tone === "light") {
    return {
      strong: "var(--color-scrim-hero-strong)",
      mid: "var(--color-scrim-hero-mid)",
      soft: "var(--color-scrim-hero-soft)",
    };
  }

  return {
    strong: "var(--color-scrim-hero-mid)",
    mid: "var(--color-scrim-hero-soft)",
    soft: "color-mix(in srgb, var(--color-scrim-hero-soft) 55%, transparent)",
  };
}

/** Horizontal hero scrim gradient (left-heavy copy column). */
export function toneAwareHeroScrimGradient(tone: OverlayTone): string {
  const { strong, mid } = toneAwareScrimStops(tone);
  return `linear-gradient(to right, ${strong} 0%, ${mid} 55%, transparent 100%)`;
}
