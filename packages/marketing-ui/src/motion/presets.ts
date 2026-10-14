import type { RevealVariant } from "./reveal/variants.js";

/** Locked marketing motion presets — do not sprinkle index * N at call sites. */
export const MARKETING_CARD_REVEAL = {
  variant: "rise" satisfies RevealVariant,
  stepMs: 70,
  maxDelayMs: 420,
} as const;

export const MARKETING_SECTION_REVEAL = {
  variant: "rise" satisfies RevealVariant,
  stepMs: 80,
  maxDelayMs: 160,
} as const;

export type MarketingRevealPreset = typeof MARKETING_CARD_REVEAL | typeof MARKETING_SECTION_REVEAL;

export function marketingStaggerDelay(index: number, preset: MarketingRevealPreset): number {
  return Math.min(index * preset.stepMs, preset.maxDelayMs);
}
