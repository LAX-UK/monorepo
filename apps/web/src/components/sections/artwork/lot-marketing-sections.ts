/**
 * Single source of truth for catalog marketing copy on the lot/artwork surface.
 * Use these ids + titles everywhere (accordion, marketing blocks, tests, search snippets).
 */
export const lotMarketingSection = {
  condition: { id: "condition" as const, title: "Condition report" as const },
  provenance: { id: "provenance" as const, title: "Provenance" as const },
  exhibited: { id: "exhibited" as const, title: "Exhibited" as const },
  artist: { id: "artist" as const, title: "About artist" as const },
} as const;

/** Section order: condition → provenance → exhibition history → artist note. */
export const lotMarketingSectionOrder = [
  lotMarketingSection.condition,
  lotMarketingSection.provenance,
  lotMarketingSection.exhibited,
  lotMarketingSection.artist,
] as const;

export type LotMarketingSectionKey = keyof typeof lotMarketingSection;
