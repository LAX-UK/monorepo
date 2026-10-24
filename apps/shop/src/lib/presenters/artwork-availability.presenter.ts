import { resolveEditionAvailabilityPresentation } from "@/lib/presenters/shop-status-presentation";
import type { ShopStatusPresentation } from "@/lib/presenters/shop-status-presentation";
import type { PublicArtworkDetail } from "@auction/shop-contracts";

export type ArtworkAvailabilityView = {
  status: ShopStatusPresentation;
  headline: string;
  detail: string | null;
};

export function presentArtworkAvailability(artwork: PublicArtworkDetail): ArtworkAvailabilityView {
  if (artwork.saleState === "sold") {
    return {
      status: { label: "Sold out", tone: "neutral" },
      headline: "This work is no longer available",
      detail: null,
    };
  }

  if (!artwork.eligibleForEditionAllocation) {
    return {
      status: { label: "Original", tone: "neutral" },
      headline: "Original work — one of one",
      detail: "A unique piece, not part of an edition series.",
    };
  }

  const { totalEditions, state } = artwork.availability;
  const status = resolveEditionAvailabilityPresentation(state);
  const size = totalEditions > 0 ? `Limited edition of ${totalEditions}` : "Limited edition";

  if (state === "sold_out") {
    return {
      status,
      headline: `${size} · Sold out`,
      detail: "Join the list and we will email you if one is released.",
    };
  }

  return {
    status,
    headline: `${size} · Available`,
    detail: "Edition numbers are assigned when your order is fulfilled.",
  };
}
