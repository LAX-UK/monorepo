import {
  EXPRESS_PAYMENT_FAILED_MESSAGE,
  type ExpressAddressResult,
  type ExpressCheckoutAudience,
  type ExpressConfirmResult,
  type ExpressSession,
  expressConfirmationHref,
} from "./express-checkout-api";
import type { ExpressRowEvent } from "./express-checkout-state";
import {
  type WalletConfirmEvent,
  type WalletConfirmPayload,
  type WalletShippingAddressChange,
  readWalletConfirm,
  walletAddressChange,
} from "./express-checkout-wallet";
import type { StripeCheckout } from "./stripe-js";

/** Runs a server-side session update so Stripe.js re-reads the session once it is done. */
export async function withServerUpdate<T>(
  checkout: Pick<StripeCheckout, "runServerUpdate">,
  update: () => Promise<T>,
): Promise<T> {
  if (!checkout.runServerUpdate) return update();
  const box: { value?: T } = {};
  await checkout.runServerUpdate(async () => {
    box.value = await update();
  });
  if (!("value" in box)) throw new Error("Server update did not run");
  return box.value as T;
}

export type ExpressFlowPorts = {
  audience: ExpressCheckoutAudience;
  session: Pick<ExpressSession, "sessionId" | "shippingRates">;
  checkout: Pick<StripeCheckout, "confirm" | "runServerUpdate">;
  dispatch: (event: ExpressRowEvent) => void;
  changeAddress: (address: {
    country: string;
    postcode?: string;
    city?: string;
  }) => Promise<ExpressAddressResult>;
  confirmOrder: (payload: WalletConfirmPayload) => Promise<ExpressConfirmResult>;
  /** Releases the order's print hold after a payment that did not go through. */
  cancelOrder: (orderId: string) => Promise<unknown>;
  /** Reloads the page's data (the basket) after a print sold out. */
  refresh: () => void;
  navigate: (href: string) => void;
  origin: string;
};

/** The sheet's address change: a UK address keeps both rates, anything else is refused. */
export async function handleExpressAddressChange(
  ports: ExpressFlowPorts,
  event: WalletShippingAddressChange & { resolve(): void; reject(): void },
): Promise<void> {
  let answer: ExpressAddressResult;
  try {
    answer = await ports.changeAddress(walletAddressChange(event));
  } catch {
    answer = { kind: "refused", message: EXPRESS_PAYMENT_FAILED_MESSAGE };
  }
  if (answer.kind === "ok") {
    event.resolve();
    return;
  }
  event.reject();
  ports.dispatch({ type: "address_refused", message: answer.message });
}

/**
 * The shopper confirmed in the sheet. The Shop makes the order and binds the session to it; only
 * then does Stripe take the payment. Every refusal fails the sheet and says the shopper has not
 * been charged; a print sold meanwhile says so and reloads the basket.
 */
export async function handleExpressConfirm(
  ports: ExpressFlowPorts,
  event: WalletConfirmEvent & { paymentFailed(options?: { reason?: string }): void },
): Promise<void> {
  ports.dispatch({ type: "confirm_started" });
  const reading = readWalletConfirm(event, ports.session.shippingRates, {
    requireEmail: ports.audience === "guest",
  });
  if (reading.kind === "invalid") {
    event.paymentFailed({ reason: "fail" });
    ports.dispatch({ type: "not_charged", message: reading.message });
    return;
  }

  let orderId: string | null = null;
  try {
    const result = await withServerUpdate(ports.checkout, () =>
      ports.confirmOrder(reading.payload),
    );
    if (result.kind === "sold_out") {
      event.paymentFailed({ reason: "fail" });
      ports.dispatch({ type: "sold_out", message: result.message });
      ports.refresh();
      return;
    }
    if (result.kind !== "confirmed") {
      event.paymentFailed({ reason: "fail" });
      ports.dispatch({ type: "not_charged", message: result.message });
      return;
    }
    orderId = result.orderId;
    const href = expressConfirmationHref(orderId);
    const payment = await ports.checkout.confirm({
      expressCheckoutConfirmEvent: event,
      redirect: "if_required",
      returnUrl: new URL(href, ports.origin).toString(),
    });
    if (payment.type === "error") throw new Error(payment.error?.message ?? "payment failed");
    ports.dispatch({ type: "paid", orderId });
    ports.navigate(href);
  } catch {
    // Nothing was charged: release the print rather than hold it until the session ends.
    event.paymentFailed({ reason: "fail" });
    ports.dispatch({ type: "not_charged", message: EXPRESS_PAYMENT_FAILED_MESSAGE });
    if (orderId) await ports.cancelOrder(orderId).catch(() => undefined);
  }
}
