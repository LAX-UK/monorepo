import { resolveEditionAvailabilityPresentation } from "@/lib/presenters/shop-status-presentation";
import type { ShopStatusPresentation } from "@/lib/presenters/shop-status-presentation";
import type { PublicArtworkDetail } from "@auction/shop-contracts";

export type ArtworkAvailabilityView = {
  status: ShopStatusPresentation;
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
      detail: "Join the list and we will email you if one is released.",
      meter: { available: editionsAvailable, total: totalEditions },
    };
  }

  const limited = status.tone === "warning";
  return {
    status,
    headline: `${editionsAvailable} of ${totalEditions} editions available`,
    detail: limited
      ? `Only a few remain from this edition of ${totalEditions}.`
      : "Edition numbers are assigned when your order is fulfilled.",
    meter: { available: editionsAvailable, total: totalEditions },
  };
}
