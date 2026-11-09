"use server";

import { checkoutReturnUrls } from "@/lib/checkout/checkout-return-urls.server";
import {
  type DeliveryQuoteStartResult,
  deliveryQuoteStartResult,
} from "@/lib/checkout/delivery-quote-request";
import { commerceErrorMessage } from "@/lib/commerce-error-message";
import { fetchShopCommerceCsrfForMutation } from "@/lib/shop-commerce-mutation.server";
import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";
import type { ShopDeliveryAddressInput } from "@/lib/shop-fulfilment";

type QuoteRequestInput = {
  basketId: string;
  deliveryAddress: ShopDeliveryAddressInput;
  deliveryPhone: string;
};

async function post(path: string, body: unknown): Promise<DeliveryQuoteStartResult> {
  const csrf = await fetchShopCommerceCsrfForMutation();
  if (!csrf.ok) {
    return {
      kind: "error",
      message: commerceErrorMessage({ error: "csrf_failed" }, "Could not send your request."),
    };
  }
  const response = await shopCommerceRequest(
    path,
    {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    { applyCookies: true, csrfToken: csrf.token },
  ).catch(() => null);
  if (!response) {
    return { kind: "error", message: "We could not send your request. Try again shortly." };
  }
  return deliveryQuoteStartResult(response.status, await response.json().catch(() => ({})));
}

/**
 * Asks for a delivery quote on the basket, for an address outside the UK. One key per basket: a
 * retry returns the same request, so a double click holds the print once.
 */
export async function requestDeliveryQuote(
  input: QuoteRequestInput,
): Promise<DeliveryQuoteStartResult> {
  const { successUrl, cancelUrl } = checkoutReturnUrls();
  return post("/commerce/delivery-quote-request", {
    basketId: input.basketId,
    idempotencyKey: `delivery-quote:${input.basketId}`,
    deliveryAddress: input.deliveryAddress,
    deliveryPhone: input.deliveryPhone.trim(),
    successUrl,
    cancelUrl,
  });
}

/** The same for a guest, who also gives who they are; the server repeats the email check. */
export async function requestGuestDeliveryQuote(
  input: QuoteRequestInput & { email: string; name: string; marketingConsent: boolean },
): Promise<DeliveryQuoteStartResult> {
  const { successUrl, cancelUrl } = checkoutReturnUrls();
  return post("/commerce/guest-checkout/delivery-quote-requests", {
    basketId: input.basketId,
    idempotencyKey: `delivery-quote:${input.basketId}`,
    email: input.email.trim(),
    name: input.name.trim(),
    marketingConsent: input.marketingConsent,
    deliveryAddress: input.deliveryAddress,
    deliveryPhone: input.deliveryPhone.trim(),
    successUrl,
    cancelUrl,
  });
}
