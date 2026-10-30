import { SHOP_ORDERS_HREF } from "@/lib/account/shop-account-routes";
import { type ShopOrderDetailVm, buildShopOrderDetailVm } from "@/lib/account/shop-orders.vm";
import { shopStorefrontRegisterHref } from "@/lib/shop-viewer-state";
import type { OrderSummary } from "@auction/shop-contracts";

/** The guest's order page; the token stays in an httpOnly cookie, never in this URL. */
export const GUEST_ORDER_PATH = "/orders/guest";
export const GUEST_ORDER_INVOICE_PATH = "/orders/guest/invoice";

/** Why a guest order link did not open the order. */
export type GuestOrderLinkProblem = "expired" | "claimed" | "invalid";

export function guestOrderLinkProblem(value: string | undefined): GuestOrderLinkProblem | null {
  return value === "expired" || value === "claimed" || value === "invalid" ? value : null;
}

/** After the link is checked, the browser lands on the order page or on what went wrong. */
export function guestOrderLinkDestination(state: string | null): string {
  if (state === "valid") return GUEST_ORDER_PATH;
  const problem = guestOrderLinkProblem(state ?? undefined) ?? "invalid";
  return `${GUEST_ORDER_PATH}?link=${problem}`;
}

/**
 * The order page as a guest sees it: the same order, with the invoice from the guest route.
 * Finishing a payment and reporting a problem need an account, so they are left out; the page
 * says how to keep the order in a LAX account instead.
 */
export function buildGuestOrderDetailVm(order: OrderSummary, now: Date): ShopOrderDetailVm {
  const vm = buildShopOrderDetailVm(order, now);
  return {
    ...vm,
    finishPaying: null,
    problem: null,
    invoiceHref: order.invoiceAvailable ? GUEST_ORDER_INVOICE_PATH : null,
  };
}

/** Creating an account with the guest's email: the order then appears in "Your orders". */
export const GUEST_CREATE_ACCOUNT_HREF = shopStorefrontRegisterHref(SHOP_ORDERS_HREF);

export const GUEST_LINK_PROBLEM_COPY: Record<
  GuestOrderLinkProblem,
  { title: string; description: string }
> = {
  expired: {
    title: "This link has expired",
    description:
      "Order links work for 30 days. Enter your email and order reference and we will send you a new one.",
  },
  claimed: {
    title: "This order is in your LAX account",
    description:
      "You created a LAX account with this email, so the order moved there. Sign in to see it with the rest of your orders.",
  },
  invalid: {
    title: "We could not open this order",
    description:
      "The link may be incomplete. Open it again from your email, or ask for a new one with your email and order reference.",
  },
};
