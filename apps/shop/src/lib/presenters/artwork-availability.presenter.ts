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

  const { totalEditions, state } = artwork.availability;
  const status = resolveEditionAvailabilityPresentation(state);
  const size = totalEditions > 0 ? `Limited edition of ${totalEditions}` : "Limited edition";

  // The status pill beside the headline carries "Available" or "Sold out", and the sold-out
  // panel above already offers the waiting list, so neither is repeated here.
  if (state === "sold_out") {
    return { status, headline: size, detail: null };
  }

  return {
    status,
    headline: size,
    detail: "Edition numbers are assigned when your order is fulfilled.",
  };
}
