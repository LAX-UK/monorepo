import { shopOrderHref } from "@/lib/account/shop-account-routes";
import {
  type ShopOrderDeliveryVm,
  type ShopOrderLineVm,
  type ShopOrderTotalsVm,
  buildShopOrderDelivery,
  buildShopOrderLines,
  buildShopOrderTotals,
  shopOrderInvoiceHref,
  shopOrderReference,
} from "@/lib/account/shop-orders.vm";
import { type CheckoutDeliveryTimes, workingDayWindowLine } from "@/lib/checkout/checkout-delivery";
import { isShopCollectionFulfilment } from "@/lib/presenters/shop-fulfilment.presenter";
import type { OrderSummary } from "@auction/shop-contracts";

export type OrderConfirmationStep = { title: string; text: string };

export type OrderConfirmationVm = {
  heading: string;
  reference: string;
  /** "A receipt is on its way to robert@example.com." */
  receiptLine: string;
  nextSteps: OrderConfirmationStep[];
  orderHref: string;
  invoiceHref: string | null;
  lines: ShopOrderLineVm[];
  totals: ShopOrderTotalsVm;
  delivery: ShopOrderDeliveryVm;
};

/** The shopper's first name for the greeting, never an email address. */
export function confirmationFirstName(displayName: string | null | undefined): string | null {
  const first = displayName?.trim().split(/\s+/)[0];
  if (!first || first.includes("@")) return null;
  return first;
}

function deliveryStep(order: OrderSummary, times: CheckoutDeliveryTimes): OrderConfirmationStep {
  const paidAt = new Date(order.paidAt ?? order.createdAt);
  if (isShopCollectionFulfilment(order.fulfilment)) {
    const ready = times.collection
      ? ` ${workingDayWindowLine(paidAt, times.collection, "It should be ready from")}.`
      : "";
    return {
      title: "Collection",
      text: `We will contact you to arrange a time to collect it from our London gallery.${ready}`,
    };
  }
  if (order.fulfilment === "uk_insured_delivery") {
    const arrives = times.ukDelivery
      ? ` ${workingDayWindowLine(paidAt, times.ukDelivery, "Expected to arrive")}.`
      : "";
    return {
      title: "Delivery",
      text: `We send it by UK insured delivery and email you when it is dispatched.${arrives}`,
    };
  }
  return {
    title: "Delivery",
    text: "We will contact you about how your order reaches you.",
  };
}

/**
 * What a paid order's confirmation says: the reference, where the receipt went, what happens next
 * (preparation, delivery or collection, following progress, the 14 days to cancel) and the order.
 * Delivery and collection times appear only when operations have configured them.
 */
export function buildOrderConfirmationVm(input: {
  order: OrderSummary;
  displayName: string | null;
  email: string | null;
  times: CheckoutDeliveryTimes;
  /** Where a guest opens the order and invoice; an account uses its order page. */
  links?: { orderHref: string; invoiceHref: string };
}): OrderConfirmationVm {
  const { order } = input;
  const reference = shopOrderReference(order);
  const firstName = confirmationFirstName(input.displayName);
  return {
    heading: firstName ? `Thank you, ${firstName}` : "Thank you for your order",
    reference,
    receiptLine: input.email
      ? `A receipt is on its way to ${input.email}.`
      : "A receipt is on its way to your email.",
    nextSteps: [
      {
        title: "Preparation",
        text: "We prepare your order. Your order page shows each stage as it happens.",
      },
      deliveryStep(order, input.times),
      {
        title: "Changed your mind?",
        text: "You can cancel within 14 days of delivery, or report a problem, from your order page.",
      },
    ],
    orderHref: input.links?.orderHref ?? shopOrderHref(order.orderId),
    invoiceHref: order.invoiceAvailable
      ? (input.links?.invoiceHref ?? shopOrderInvoiceHref(order.orderId))
      : null,
    lines: buildShopOrderLines(order),
    totals: buildShopOrderTotals(order),
    delivery: buildShopOrderDelivery(order),
  };
}
