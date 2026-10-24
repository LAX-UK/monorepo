import type { OrderStatus, PublicArtworkSummary } from "@auction/shop-contracts";
import type {
  EditionCustodyStatus,
  EditionListingStatus,
  ShopOriginalSaleStatus,
} from "@auction/shop-domain";
import { formatGbpPence } from "@auction/shop-portal/vm";
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

export type ShopOrderStatus = OrderStatus;

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
  partially_refunded: {
    label: "Partly refunded",
    tone: "warning",
    hint: "Part of this order has been refunded to your original payment method.",
  },
  refunded: {
    label: "Refunded",
    tone: "neutral",
    hint: "This order has been refunded to your original payment method.",
  },
};

/** "£40.00 refunded" for an order that has been refunded in whole or part; null otherwise. */
export function resolveShopOrderRefundLine(order: {
  status: ShopOrderStatus;
  refundedPence?: number;
}): string | null {
  if (order.status !== "refunded" && order.status !== "partially_refunded") return null;
  if (!order.refundedPence) return null;
  return `${formatGbpPence(order.refundedPence)} refunded`;
}

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

const PORTAL_LISTING_STATUS: Record<EditionListingStatus, ShopStatusPresentation> = {
  not_authorised: { label: "Not authorised", tone: "neutral" },
  authorised: { label: "Authorised for sale", tone: "success" },
  reserved: { label: "Reserved", tone: "pending" },
  held: { label: "On hold", tone: "warning" },
  sold: { label: "Sold", tone: "neutral" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

const PORTAL_CUSTODY_STATUS: Record<EditionCustodyStatus, ShopStatusPresentation> = {
  unprinted: { label: "Unprinted", tone: "neutral" },
  in_production: { label: "In production", tone: "pending" },
  qc_failed: { label: "QC failed", tone: "critical" },
  stored: { label: "Stored at LAX", tone: "neutral" },
  in_transit: { label: "In transit", tone: "pending" },
  delivered: { label: "Delivered", tone: "success" },
  collected: { label: "Collected", tone: "success" },
  with_owner: { label: "With owner", tone: "accent" },
  returned: { label: "Returned", tone: "neutral" },
};

const unknownPortalStatus: ShopStatusPresentation = { label: "Unknown", tone: "neutral" };

export function resolvePortalListingStatusPresentation(
  listingStatus: string,
): ShopStatusPresentation {
  if (listingStatus in PORTAL_LISTING_STATUS) {
    return PORTAL_LISTING_STATUS[listingStatus as EditionListingStatus];
  }
  return unknownPortalStatus;
}

export function resolvePortalCustodyStatusPresentation(
  custodyStatus: string,
): ShopStatusPresentation {
  if (custodyStatus in PORTAL_CUSTODY_STATUS) {
    return PORTAL_CUSTODY_STATUS[custodyStatus as EditionCustodyStatus];
  }
  return unknownPortalStatus;
}

const PORTAL_ORIGINAL_SALE_STATUS: Record<ShopOriginalSaleStatus, ShopStatusPresentation> = {
  reserved: { label: "Reserved", tone: "pending" },
  deposit_due: { label: "Deposit due", tone: "warning" },
  invoiced: { label: "Invoiced", tone: "pending" },
  paid: { label: "Paid", tone: "success" },
  assigned: { label: "Yours", tone: "accent" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export function resolvePortalOriginalSaleStatusPresentation(
  status: string,
): ShopStatusPresentation {
  if (status in PORTAL_ORIGINAL_SALE_STATUS) {
    return PORTAL_ORIGINAL_SALE_STATUS[status as ShopOriginalSaleStatus];
  }
  return unknownPortalStatus;
}
