export const REVEAL_VARIANTS = ["rise", "fadeUp", "wipe", "zoom", "wipeZoom", "textLine"] as const;

export type RevealVariant = (typeof REVEAL_VARIANTS)[number];

export function revealVariantClass(variant: RevealVariant): `reveal--${RevealVariant}` {
  return `reveal--${variant}`;
}
