import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { QUOTE_PAYMENT_WINDOW_MS } from "@auction/shop-domain";
import { ShopApiError } from "../../errors/shop-api-error.js";
import type { CheckoutOrderResult, CheckoutWriter } from "../ports/commerce.ports.js";

/**
 * Takes the quote's price into the order, in one transaction: the delivery becomes the order's
 * delivery charge, the total becomes the goods plus that charge, and the hold and the prints'
 * reservation run on for the time it takes to pay. Safe to repeat: an order already updated for
 * this quote is returned as it is.
 */
export interface DeliveryQuoteAcceptanceStore {
  accept(input: {
    subject: string;
    orderId: string;
    now: Date;
    /** When the payment window ends; the hold and the reservation are extended to it. */
    paymentEndsAt: Date;
  }): Promise<void>;
}

export type DeliveryQuoteAcceptanceDeps = {
  store: DeliveryQuoteAcceptanceStore;
  checkout: Pick<CheckoutWriter, "resumeCheckoutOrder">;
  /** Whether delivery outside the UK may be paid for yet. Quoting does not depend on it. */
  exportPaymentEnabled: boolean;
  now?: () => Date;
};

/**
 * The buyer's "accept and pay" on a quote. Payment outside the UK waits for the accountant's
 * answer on VAT, so with it closed nothing is accepted either: the quote stays as it was, and the
 * buyer is told payment is not open. With it open, accepting prices the order and then opens
 * payment, which checks again that what is paid is the goods plus the delivery that was quoted.
 */
export function createDeliveryQuoteAcceptanceService(deps: DeliveryQuoteAcceptanceDeps) {
  const now = deps.now ?? (() => new Date());
  return {
    async acceptAndPay(input: {
      subject: string;
      orderId: string;
      successUrl: string;
      cancelUrl: string;
    }): Promise<CheckoutOrderResult> {
      if (!deps.exportPaymentEnabled) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.CONFLICT,
          "Payment for delivery outside the UK is not open yet",
          409,
        );
      }
      const at = now();
      await deps.store.accept({
        subject: input.subject,
        orderId: input.orderId,
        now: at,
        paymentEndsAt: new Date(at.getTime() + QUOTE_PAYMENT_WINDOW_MS),
      });
      return deps.checkout.resumeCheckoutOrder({
        subject: input.subject,
        orderId: input.orderId,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
      });
    },
  };
}

export type DeliveryQuoteAcceptanceService = ReturnType<
  typeof createDeliveryQuoteAcceptanceService
>;
