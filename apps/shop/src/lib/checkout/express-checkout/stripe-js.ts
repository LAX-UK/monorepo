import type { WalletConfirmEvent, WalletShippingAddressChange } from "./express-checkout-wallet";

/**
 * Stripe.js for the wallet row, loaded from Stripe (never bundled: Stripe requires the script from
 * js.stripe.com, and loading it here keeps it out of the route's start-up JavaScript). Only the
 * basket and Details allow it in their Content-Security-Policy, and only while
 * SHOP_EXPRESS_CHECKOUT is on. The version path matches the API version shop-api pins
 * (2025-08-27.basil).
 */
export const STRIPE_JS_URL = "https://js.stripe.com/basil/stripe.js";

/** The subset of Checkout Sessions in Elements mode (`stripe.initCheckout`) the row uses. */
export type ExpressCheckoutElement = {
  mount(target: HTMLElement): void;
  destroy(): void;
  on(
    event: "ready",
    handler: (event: { availablePaymentMethods?: Record<string, boolean> | null }) => void,
  ): void;
  on(event: "loaderror", handler: (event: { error?: { message?: string } }) => void): void;
  on(
    event: "click",
    handler: (event: { resolve(options?: Record<string, unknown>): void }) => void,
  ): void;
  on(
    event: "shippingaddresschange",
    handler: (
      event: WalletShippingAddressChange & {
        resolve(update?: Record<string, unknown>): void;
        reject(): void;
      },
    ) => void,
  ): void;
  on(
    event: "confirm",
    handler: (
      event: WalletConfirmEvent & { paymentFailed(options?: { reason?: string }): void },
    ) => void,
  ): void;
  on(event: "cancel", handler: () => void): void;
};

export type StripeCheckoutConfirmResult =
  | { type: "success" }
  | { type: "error"; error?: { message?: string } };

export type StripeCheckout = {
  createExpressCheckoutElement(options: Record<string, unknown>): ExpressCheckoutElement;
  confirm(options: {
    expressCheckoutConfirmEvent: unknown;
    redirect: "if_required";
    returnUrl: string;
  }): Promise<StripeCheckoutConfirmResult>;
  /** Re-reads the session after a server-side update so the sheet shows what Stripe will charge. */
  runServerUpdate?: (update: () => Promise<unknown>) => Promise<unknown>;
};

export type StripeJs = {
  initCheckout(options: {
    fetchClientSecret: () => Promise<string>;
    elementsOptions?: Record<string, unknown>;
  }): Promise<StripeCheckout>;
};

type StripeFactory = (publishableKey: string) => StripeJs;

declare global {
  interface Window {
    Stripe?: StripeFactory;
  }
}

let loading: Promise<StripeFactory> | null = null;

/** Adds the script once per page; a failed load can be retried on the next mount. */
export function loadStripeJs(doc: Document = document): Promise<StripeFactory> {
  const existing = doc.defaultView?.Stripe;
  if (existing) return Promise.resolve(existing);
  if (loading) return loading;
  loading = new Promise<StripeFactory>((resolve, reject) => {
    const script = doc.createElement("script");
    script.src = STRIPE_JS_URL;
    script.async = true;
    script.onload = () => {
      const factory = doc.defaultView?.Stripe;
      if (factory) resolve(factory);
      else reject(new Error("Stripe.js loaded without Stripe"));
    };
    script.onerror = () => reject(new Error("Stripe.js could not load"));
    doc.head.appendChild(script);
  }).catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}
