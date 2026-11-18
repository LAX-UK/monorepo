"use server";

import {
  EXPRESS_UNAVAILABLE_MESSAGE,
  type ExpressAddressResult,
  type ExpressCheckoutAudience,
  type ExpressCheckoutStep,
  type ExpressConfirmResult,
  type ExpressRateId,
  type ExpressStartResult,
  expressAddressResult,
  expressCheckoutPath,
  expressConfirmResult,
  expressStartResult,
} from "@/lib/checkout/express-checkout/express-checkout-api";
import { fetchShopCommerceCsrfForMutation } from "@/lib/shop-commerce-mutation.server";
import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";
import { isShopExpressCheckoutEnabled } from "@/lib/shop-runtime-flags";

const JSON_HEADERS = { accept: "application/json", "content-type": "application/json" };

async function post(
  audience: ExpressCheckoutAudience,
  step: ExpressCheckoutStep,
  body: unknown,
): Promise<{ status: number; body: unknown } | null> {
  if (!isShopExpressCheckoutEnabled()) {
    return { status: 404, body: { code: "shop.feature_disabled" } };
  }
  const csrf = await fetchShopCommerceCsrfForMutation();
  if (!csrf.ok) return null;
  const response = await shopCommerceRequest(
    expressCheckoutPath(audience === "guest" ? "guest" : "account", step),
    { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) },
    { applyCookies: true, csrfToken: csrf.token },
  ).catch(() => null);
  if (!response) return null;
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

/** Opens the Elements-mode Checkout Session for the basket. Nothing is ordered or held yet. */
export async function startExpressCheckout(input: {
  audience: ExpressCheckoutAudience;
  basketId: string;
}): Promise<ExpressStartResult> {
  const result = await post(input.audience, "start", { basketId: input.basketId });
  if (!result) return { kind: "error", message: EXPRESS_UNAVAILABLE_MESSAGE };
  return expressStartResult(result.status, result.body);
}

/** The sheet's address change: a UK address keeps both rates, anything else is refused. */
export async function changeExpressShippingAddress(input: {
  audience: ExpressCheckoutAudience;
  basketId: string;
  sessionId: string;
  address: { country: string; postcode?: string; city?: string };
}): Promise<ExpressAddressResult> {
  const result = await post(input.audience, "shipping-address", {
    basketId: input.basketId,
    sessionId: input.sessionId,
    address: input.address,
  });
  if (!result) return { kind: "refused", message: EXPRESS_UNAVAILABLE_MESSAGE };
  return expressAddressResult(result.status, result.body);
}

/** The shopper confirmed in the sheet: the Shop makes the order and holds its prints. */
export async function confirmExpressCheckout(input: {
  audience: ExpressCheckoutAudience;
  basketId: string;
  sessionId: string;
  shippingRateId: ExpressRateId;
  name: string;
  phone?: string;
  email?: string;
  marketingConsent?: boolean;
  shippingAddress: {
    recipientName: string;
    line1: string;
    line2?: string;
    city: string;
    postcode: string;
    country: "GB";
  };
}): Promise<ExpressConfirmResult> {
  const guest = input.audience === "guest";
  const result = await post(input.audience, "confirm", {
    basketId: input.basketId,
    sessionId: input.sessionId,
    shippingRateId: input.shippingRateId,
    name: input.name,
    ...(input.phone ? { phone: input.phone } : {}),
    shippingAddress: input.shippingAddress,
    ...(guest
      ? { email: input.email ?? "", marketingConsent: input.marketingConsent === true }
      : {}),
  });
  if (!result) return { kind: "error", message: EXPRESS_UNAVAILABLE_MESSAGE };
  return expressConfirmResult(result.status, result.body);
}
