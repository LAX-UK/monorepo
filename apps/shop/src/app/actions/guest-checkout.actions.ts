"use server";

import {
  type GuestEmailStepResult,
  type GuestOrderStartResult,
  guestEmailStepResult,
  guestOrderStartResult,
} from "@/lib/checkout/guest-checkout";
import { commerceErrorMessage } from "@/lib/commerce-error-message";
import { fetchShopCommerceCsrfForMutation } from "@/lib/shop-commerce-mutation.server";
import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";
import type { ShopDeliveryAddressInput, ShopFulfilmentOption } from "@/lib/shop-fulfilment";
import { isValidUkPostcode, normalizeUkPostcode } from "@/lib/uk-postcode";
import { headers } from "next/headers";

const JSON_HEADERS = { accept: "application/json", "content-type": "application/json" };

async function postToCommerce(path: string, body: unknown) {
  const csrf = await fetchShopCommerceCsrfForMutation();
  if (!csrf.ok) return null;
  const response = await shopCommerceRequest(
    path,
    { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) },
    { applyCookies: true, csrfToken: csrf.token },
  ).catch(() => null);
  if (!response) return null;
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

/** The email step: continue as a guest, or sign in because the email has a LAX account. */
export async function checkGuestEmail(input: {
  email: string;
  marketingConsent: boolean;
  /** The hidden field people never see; anything in it marks a bot. */
  website?: string;
}): Promise<GuestEmailStepResult> {
  const result = await postToCommerce("/commerce/guest-checkout/email-checks", {
    email: input.email.trim(),
    marketingConsent: input.marketingConsent,
    ...(input.website ? { website: input.website } : {}),
  });
  if (!result) return guestEmailStepResult(500, null);
  return guestEmailStepResult(result.status, result.body);
}

async function storefrontOrigin(): Promise<string> {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3020";
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/** Places the guest's order and opens the payment page. The server checks the email again. */
export async function startGuestCheckout(input: {
  basketId: string;
  email: string;
  name: string;
  marketingConsent: boolean;
  fulfilment: ShopFulfilmentOption;
  deliveryAddress?: ShopDeliveryAddressInput;
  deliveryPhone?: string;
}): Promise<GuestOrderStartResult> {
  if (input.fulfilment === "international_quotation") {
    return {
      kind: "error",
      message: "Delivery outside the UK is not available online yet. Contact us for a quote.",
    };
  }
  let deliveryAddress = input.deliveryAddress;
  if (input.fulfilment === "uk_insured_delivery" && deliveryAddress) {
    if (!isValidUkPostcode(deliveryAddress.postcode)) {
      return { kind: "error", message: "Enter a UK postcode, like SW1A 1AA." };
    }
    deliveryAddress = {
      ...deliveryAddress,
      postcode: normalizeUkPostcode(deliveryAddress.postcode),
    };
  }
  const origin = await storefrontOrigin();
  const result = await postToCommerce("/commerce/guest-checkout/orders", {
    basketId: input.basketId,
    email: input.email.trim(),
    name: input.name.trim(),
    marketingConsent: input.marketingConsent,
    fulfilment: input.fulfilment,
    // One key per basket, as for account checkout: a retry updates the same pending order.
    idempotencyKey: `guest-checkout:${input.basketId}:order`,
    successUrl: `${origin}/checkout/confirmation?orderId={ORDER_ID}`,
    cancelUrl: `${origin}/checkout/cancel?orderId={ORDER_ID}`,
    ...(deliveryAddress ? { deliveryAddress } : {}),
    ...(input.deliveryPhone?.trim() ? { deliveryPhone: input.deliveryPhone.trim() } : {}),
  });
  if (!result) {
    return {
      kind: "error",
      message: commerceErrorMessage({ error: "csrf_failed" }, "Could not start checkout."),
    };
  }
  return guestOrderStartResult(result.status, result.body);
}

/** Asks for a new link to a guest order. The answer is the same whether or not it matched. */
export async function requestGuestOrderLink(input: {
  email: string;
  orderReference: string;
}): Promise<{ kind: "sent" } | { kind: "error"; message: string }> {
  const result = await postToCommerce("/commerce/guest-orders/links", {
    email: input.email.trim(),
    orderReference: input.orderReference.trim(),
  });
  if (result?.status === 202) return { kind: "sent" };
  if (result?.status === 429) {
    return { kind: "error", message: "Too many requests. Wait a few minutes and try again." };
  }
  if (result?.status === 400) {
    return { kind: "error", message: "Check the email address and order reference." };
  }
  return { kind: "error", message: "We could not send a new link. Try again shortly." };
}
