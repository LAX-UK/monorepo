import { resolveEditionAvailabilityPresentation } from "@/lib/presenters/art-status-presentation";
import type { ArtStatusPresentation } from "@/lib/presenters/art-status-presentation";
import type { PublicArtworkDetail } from "@auction/shop-contracts";

export type ArtworkAvailabilityView = {
  status: ArtStatusPresentation;
  headline: string;
  detail: string | null;
  /** True for an edition run, so the page can show the "Limited edition of N" line. */
  isEdition: boolean;
};

export function presentArtworkAvailability(artwork: PublicArtworkDetail): ArtworkAvailabilityView {
  if (artwork.saleState === "sold") {
    return {
      status: { label: "Sold out", tone: "neutral" },
      headline: "This work is no longer available",
      detail: null,
      isEdition: false,
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
        isEdition: false,
      };
    }
    return {
      status: { label: "Original", tone: "neutral" },
      headline: "Original work — one of one",
      detail: "A unique piece, not part of an edition series.",
      isEdition: false,
    };
  }

  const { totalEditions, state } = artwork.availability;
  const status = resolveEditionAvailabilityPresentation(state);
  const size = totalEditions > 0 ? `Limited edition of ${totalEditions}` : "Limited edition";

  if (state === "sold_out") {
    return { status, headline: `${size} · Sold out`, detail: null, isEdition: true };
  }

  return {
    status,
    headline: `${size} · Available`,
    detail: "Edition numbers are assigned when your purchase is confirmed.",
    isEdition: true,
  };
}
