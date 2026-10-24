import type { DotStatusPillTone } from "@auction/ui/components/dot-status-pill";

export type ArtStatusPresentation = {
  label: string;
  tone: DotStatusPillTone;
  hint?: string;
};

export type EditionAvailabilityKind = "available" | "sold_out";

const EDITION_AVAILABILITY: Record<EditionAvailabilityKind, ArtStatusPresentation> = {
  available: { label: "Available", tone: "success" },
  sold_out: { label: "Sold out", tone: "neutral" },
};

/** Public availability is only ever "Available" or "Sold out"; there is no low-stock tier. */
export function resolveEditionAvailabilityPresentation(
  state: EditionAvailabilityKind,
): ArtStatusPresentation {
  return EDITION_AVAILABILITY[state];
}
