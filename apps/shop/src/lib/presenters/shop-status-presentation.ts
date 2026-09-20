import type { PublicArtworkSummary } from "@auction/shop-contracts";
import type { DotStatusPillTone } from "@auction/ui/components/dot-status-pill";

type PublicArtworkSaleState = PublicArtworkSummary["saleState"];

export type ShopStatusPresentation = {
  label: string;
  tone: DotStatusPillTone;
  hint?: string;
};

const ARTWORK_SALE_STATE: Record<PublicArtworkSaleState, ShopStatusPresentation> = {
  for_sale: { label: "For sale", tone: "success" },
  price_on_application: {
    label: "Price on request",
    tone: "accent",
    hint: "Contact LAX and we will share the price for this work.",
  },
  sold: { label: "Sold", tone: "neutral" },
};

export type ShopOrderStatus =
  | "pending_payment"
  | "paid"
  | "cancelled"
  | "expired"
  | "payment_failed";

const ORDER_STATUS: Record<ShopOrderStatus, ShopStatusPresentation> = {
  pending_payment: {
    label: "Pending payment",
    tone: "pending",
    hint: "We are waiting for your payment to clear.",
  },
  paid: { label: "Paid", tone: "success" },
  cancelled: {
    label: "Cancelled",
    tone: "critical",
    hint: "This order was cancelled before payment completed.",
  },
  expired: {
    label: "Expired",
    tone: "neutral",
    hint: "The reservation window closed and the editions were released.",
  },
  payment_failed: {
    label: "Payment failed",
    tone: "critical",
    hint: "Your payment did not go through. Nothing was charged.",
  },
};

export type EditionAvailabilityKind = "available" | "limited" | "sold_out";

const EDITION_AVAILABILITY: Record<EditionAvailabilityKind, ShopStatusPresentation> = {
  available: { label: "Available", tone: "success" },
  limited: { label: "Limited", tone: "warning" },
  sold_out: { label: "Sold out", tone: "neutral" },
};

export function resolveArtworkSaleStatePresentation(
  saleState: PublicArtworkSaleState,
): ShopStatusPresentation {
  return ARTWORK_SALE_STATE[saleState];
}

export function resolveShopOrderStatusPresentation(
  status: ShopOrderStatus,
): ShopStatusPresentation {
  return ORDER_STATUS[status];
}

export function resolveEditionAvailabilityPresentation(input: {
  editionsAvailable: number;
  totalEditions: number;
}): ShopStatusPresentation {
  if (input.editionsAvailable <= 0) {
    return EDITION_AVAILABILITY.sold_out;
  }
  if (input.totalEditions > 0 && input.editionsAvailable / input.totalEditions <= 0.2) {
    return EDITION_AVAILABILITY.limited;
  }
  return EDITION_AVAILABILITY.available;
}

/** Catalogue cards show Price on request and Sold out only; for_sale has no badge. */
export function resolveCatalogueArtworkBadgePresentation(
  saleState: PublicArtworkSaleState,
): ShopStatusPresentation | null {
  if (saleState === "for_sale") return null;
  if (saleState === "sold") {
    return { label: "Sold out", tone: "neutral" };
  }
  return resolveArtworkSaleStatePresentation(saleState);
}
