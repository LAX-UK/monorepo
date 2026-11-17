import type { ExpressShippingRate, ExpressShippingRateId } from "@auction/shop-contracts";
import type {
  BasketOwner,
  ExpressShippingDetails,
  HostedCheckoutLineItem,
} from "./commerce.ports.js";

export type { ExpressShippingDetails, ExpressShippingRate, ExpressShippingRateId };

/** Where Stripe has an express session got to, as far as the Shop needs to know. */
export type ExpressCheckoutSnapshot = {
  sessionId: string;
  status: "open" | "complete" | "expired";
  /** Whether the session is one the Shop opened for express checkout. */
  isShopExpress: boolean;
  /** The basket the session was opened for. */
  basketId: string | null;
  /** The order bound to it on confirm; null until then. */
  orderId: string | null;
  currency: string | null;
  /** The line items before delivery, in pence. */
  amountSubtotalPence: number | null;
  /** What the session will charge now, delivery included, in pence. */
  amountTotalPence: number | null;
  /** The amount of each delivery rate the session offers, in pence (one once bound). */
  shippingOptionAmountsPence: number[];
  /** The shipping details the session holds; null until the Shop sets them on confirm. */
  shippingDetails: ExpressSessionShippingDetails | null;
  /**
   * How many times the Shop has bound the session (0 before the first). Each bind writes the next
   * value and keys its update by the value it read, so every bind that changes the session is a
   * new request to Stripe, while a retry of a bind that never landed reuses its key.
   */
  bindRevision: number;
};

/** A session's shipping details as Stripe holds them. */
export type ExpressSessionShippingDetails = {
  name: string;
  line1: string;
  line2: string | null;
  city: string;
  postcode: string;
  country: string;
};

/**
 * Stripe's side of express checkout: an Elements-mode Checkout Session (the same Checkout
 * Sessions API and the same `checkout.session.completed` webhook as the hosted page). Kept apart
 * from `PaymentCheckoutGateway`, which only the hosted page needs.
 */
export interface ExpressCheckoutGateway {
  /** Opens a session for a basket. Nothing is ordered or held until the shopper confirms. */
  createExpressCheckout(input: {
    basketId: string;
    /** The same basket contents give the same session on a retry. */
    idempotencyKey: string;
    lines: HostedCheckoutLineItem[];
    /** The goods and framing, in pence; must equal the lines. */
    subtotalPence: number;
    shippingRates: readonly ExpressShippingRate[];
    returnUrl: string;
    expiresAt: Date;
    customerEmail?: string | null;
  }): Promise<{ sessionId: string; clientSecret: string; expiresAt: Date }>;
  /** The session as Stripe has it now; null when Stripe does not know it. */
  readExpressCheckout(input: { sessionId: string }): Promise<ExpressCheckoutSnapshot | null>;
  /**
   * Binds the session to the order made on confirm: the order id and reference go into the
   * session's metadata (which the webhook reads), the chosen rate becomes the only rate and the
   * wallet's address becomes the session's shipping details. Returns the total in Stripe's
   * response, which may be a replay of an earlier request: callers read the session back before
   * trusting it.
   */
  bindExpressCheckout(input: {
    sessionId: string;
    orderId: string;
    orderReference: string | null;
    basketId: string;
    shippingRate: ExpressShippingRate;
    shipping: ExpressShippingDetails;
    /** Written to the session's metadata; the snapshot's `bindRevision` plus one. */
    bindRevision: number;
    idempotencyKey: string;
  }): Promise<{ amountTotalPence: number | null }>;
}

/** The basket an express session is opened for, priced and checked as an order would be. */
export type ExpressCheckoutBasket = {
  lines: HostedCheckoutLineItem[];
  /** The goods and framing, in pence. */
  subtotalPence: number;
  /** Changes whenever what would be ordered changes, so a retry reuses the same session. */
  contentKey: string;
};

export interface ExpressCheckoutBasketReader {
  /**
   * The basket with every check an order makes (owner, empty, price, stock, limits, framing);
   * refuses as the order would.
   */
  loadExpressBasket(input: {
    basketId: string;
    ownedBy: (owner: BasketOwner) => boolean;
  }): Promise<ExpressCheckoutBasket>;
  /** Refuses a basket that is not the caller's, or no longer open. */
  assertBasketOwned(input: {
    basketId: string;
    ownedBy: (owner: BasketOwner) => boolean;
  }): Promise<void>;
}
