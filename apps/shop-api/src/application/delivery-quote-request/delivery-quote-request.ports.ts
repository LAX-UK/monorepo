import type { DeliveryQuoteStatus } from "@auction/domain";
import type { DeliveryRegionId } from "@auction/shop-domain";
import type { ShopDeliveryAddress } from "../ports/commerce.ports.js";

/** Who is asking: an account, or a guest with the browser's anonymous basket. */
export type DeliveryQuoteOwner = {
  /** The order's owner: the shopper's subject, or the guest owner value for a guest order. */
  subject: string;
  guest?: { guestCustomerId: string; basketTokenHash: string };
};

/** The country and region a quote request was assessed for. */
export type DeliveryQuoteDestination = {
  /** ISO 3166-1 alpha-2, not GB. */
  country: string;
  /** The region the country sits in; null for a country outside the four regions. */
  regionId: Exclude<DeliveryRegionId, "uk"> | null;
};

export type CreateQuoteOrderInput = DeliveryQuoteOwner &
  DeliveryQuoteDestination & {
    basketId: string;
    idempotencyKey: string;
    deliveryAddress: ShopDeliveryAddress;
    deliveryPhone: string;
    /** The quote's first status, from the shared quote steps (a new request is "requested"). */
    status: DeliveryQuoteStatus;
    /** When the held prints are released if the quote is not paid. */
    holdUntil: Date;
    /** Where the "we have your request" email goes when it cannot be read from the account. */
    fallbackEmail: string | null;
    /** A guest's keyed client IP hash, for the cap on open holds per IP; null when not known. */
    guestIpHash: string | null;
  };

export type CreatedQuoteOrder = DeliveryQuoteDestination & {
  orderId: string;
  /** "LAX-S-10482", what the buyer quotes. */
  orderReference: string;
  holdUntil: Date;
};

/**
 * Makes the order that holds a basket's prints while the gallery quotes the delivery, with its
 * quote request, in one transaction. A retry with the same key returns the same request.
 */
export interface DeliveryQuoteOrderStore {
  createQuoteOrder(input: CreateQuoteOrderInput): Promise<CreatedQuoteOrder>;
}
