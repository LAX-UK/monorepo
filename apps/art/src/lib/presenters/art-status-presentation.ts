import type { DotStatusPillTone } from "@auction/ui/components/dot-status-pill";

export type ArtStatusPresentation = {
  label: string;
  tone: DotStatusPillTone;
  hint?: string;
};

export type EditionAvailabilityKind = "available" | "limited" | "sold_out";

const EDITION_AVAILABILITY: Record<EditionAvailabilityKind, ArtStatusPresentation> = {
  available: { label: "Available", tone: "success" },
  limited: { label: "Limited", tone: "warning" },
  sold_out: { label: "Sold out", tone: "neutral" },
};

export function resolveEditionAvailabilityPresentation(input: {
  editionsAvailable: number;
  totalEditions: number;
}): ArtStatusPresentation {
  if (input.editionsAvailable <= 0) {
    return EDITION_AVAILABILITY.sold_out;
  }
  if (input.totalEditions > 0 && input.editionsAvailable / input.totalEditions <= 0.2) {
    return EDITION_AVAILABILITY.limited;
  }
  return EDITION_AVAILABILITY.available;
}
