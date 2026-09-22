import type { ShopFetchResult } from "@/lib/shop-fetch-result";
import type { OrderSummary } from "@auction/shop-contracts";

export type CheckoutConfirmationView =
  | { kind: "missing_order_id" }
  | { kind: "unauthorized" }
  | { kind: "load_failed" }
  | { kind: "not_found" }
  | { kind: "order"; order: OrderSummary; heading: string; statusMessage: string | null };

export function resolveCheckoutConfirmationView(input: {
  orderId: string | undefined;
  orderResult: ShopFetchResult<OrderSummary>;
}): CheckoutConfirmationView {
  if (!input.orderId) {
    return { kind: "missing_order_id" };
  }
  if (input.orderResult.status === "unauthorized") {
    return { kind: "unauthorized" };
  }
  if (input.orderResult.status === "failed") {
    return { kind: "load_failed" };
  }
  if (input.orderResult.status === "empty") {
    return { kind: "not_found" };
  }

  const order = input.orderResult.data;
  let heading = "Order status";
  let statusMessage: string | null = null;

  switch (order.status) {
    case "pending_payment":
      heading = "Payment processing";
      statusMessage =
        "We are confirming your payment. This page updates when your order is marked paid. If your card was declined, return to your basket to try again.";
      break;
    case "paid":
      heading = "Thank you";
      statusMessage = "Your payment was received. We will email fulfilment updates shortly.";
      break;
    case "cancelled":
      heading = "Order cancelled";
      statusMessage = "This order was cancelled before payment completed.";
      break;
    case "expired":
      heading = "Checkout expired";
      statusMessage =
        "The checkout session expired and reserved editions were released. You can place a new order from your basket.";
      break;
    case "payment_failed":
      heading = "Payment could not be completed";
      statusMessage =
        "Your payment did not go through and any reserved editions were released. Return to your basket to try again.";
      break;
  }

  return { kind: "order", order, heading, statusMessage };
}
