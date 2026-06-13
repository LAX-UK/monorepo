/** Locked marketing motion presets — do not sprinkle index * N at call sites. */
export const MARKETING_CARD_REVEAL = {
  variant: "fadeUp",
  stepMs: 50,
  maxDelayMs: 150,
} as const;

export const MARKETING_SECTION_REVEAL = {
  variant: "fadeUp",
  stepMs: 60,
  maxDelayMs: 120,
} as const;

export type MarketingRevealPreset = typeof MARKETING_CARD_REVEAL | typeof MARKETING_SECTION_REVEAL;

export function marketingStaggerDelay(index: number, preset: MarketingRevealPreset): number {
  return Math.min(index * preset.stepMs, preset.maxDelayMs);
}
