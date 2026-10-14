import { resolveEditionAvailabilityPresentation } from "@/lib/presenters/art-status-presentation";
import type { ArtStatusPresentation } from "@/lib/presenters/art-status-presentation";
import type { PublicArtworkDetail } from "@auction/shop-contracts";

export type ArtworkAvailabilityView = {
  status: ArtStatusPresentation;
  headline: string;
  detail: string | null;
  meter: { available: number; total: number } | null;
};

export function presentArtworkAvailability(artwork: PublicArtworkDetail): ArtworkAvailabilityView {
  if (artwork.saleState === "sold") {
    return {
      status: { label: "Sold out", tone: "neutral" },
      headline: "This work is no longer available",
      detail: null,
      meter: null,
    };
  }

  if (!artwork.eligibleForEditionAllocation) {
    if (artwork.rarity === "limited_edition" || artwork.rarity === "open_edition") {
      return {
        status: { label: "Original", tone: "neutral" },
        headline:
          artwork.rarity === "limited_edition"
            ? "Original work from a limited edition"
            : "Original work from an open edition",
        detail: "This impression is sold by the gallery rather than allocated online.",
        meter: null,
      };
    }
    return {
      status: { label: "Original", tone: "neutral" },
      headline: "Original work — one of one",
      detail: "A unique piece, not part of an edition series.",
      meter: null,
    };
  }

  const { editionsAvailable, totalEditions } = artwork.availability;
  const status = resolveEditionAvailabilityPresentation({
    editionsAvailable,
    totalEditions,
  });

  if (editionsAvailable <= 0) {
    return {
      status,
      headline: `All ${totalEditions} editions are currently claimed`,
      detail: null,
      meter: { available: editionsAvailable, total: totalEditions },
    };
  }

  const limited = status.tone === "warning";
  return {
    status,
    headline: `${editionsAvailable} of ${totalEditions} editions available`,
    detail: limited
      ? `Only a few remain from this edition of ${totalEditions}.`
      : "Edition numbers are assigned when your purchase is confirmed.",
    meter: { available: editionsAvailable, total: totalEditions },
  };
}
