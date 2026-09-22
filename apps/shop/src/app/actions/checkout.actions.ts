"use server";

import { commerceErrorMessage } from "@/lib/commerce-error-message";
import { fetchShopCommerceCsrfForMutation } from "@/lib/shop-commerce-mutation.server";
import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";
import { ShopContractParseError, parseCheckoutSession } from "@auction/shop-contracts";
import { headers } from "next/headers";

import type { ShopDeliveryAddressInput, ShopFulfilmentOption } from "@/lib/shop-fulfilment";

export async function startCheckout(input: {
  basketId: string;
  fulfilment: ShopFulfilmentOption;
  deliveryAddress?: ShopDeliveryAddressInput;
}): Promise<
  | { kind: "redirect"; checkoutUrl: string }
  | { kind: "enquiry" }
  | { kind: "error"; message: string }
> {
  if (input.fulfilment === "international_quotation") {
    return { kind: "enquiry" };
  }
  const csrf = await fetchShopCommerceCsrfForMutation();
  if (!csrf.ok) {
    return {
      kind: "error",
      message: commerceErrorMessage({ error: "csrf_failed" }, "Could not start checkout."),
    };
  }
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3020";
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host}`;
  const idempotencyKey = `checkout:${input.basketId}:${input.fulfilment}`;
  const response = await shopCommerceRequest(
    "/commerce/checkout",
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        basketId: input.basketId,
        fulfilment: input.fulfilment,
        idempotencyKey,
        successUrl: `${origin}/checkout/confirmation?orderId={ORDER_ID}`,
        cancelUrl: `${origin}/basket?cancelled=1&orderId={ORDER_ID}`,
        ...(input.deliveryAddress ? { deliveryAddress: input.deliveryAddress } : {}),
      }),
    },
    { applyCookies: true, csrfToken: csrf.token },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return {
      kind: "error",
      message: commerceErrorMessage(
        body,
        "Checkout could not be started. Review your basket and try again.",
      ),
    };
  }
  try {
    const session = parseCheckoutSession(await response.json());
    return { kind: "redirect", checkoutUrl: session.checkoutUrl };
  } catch (error) {
    const message =
      error instanceof ShopContractParseError
        ? "Checkout returned an unexpected response. Try again shortly."
        : "Checkout could not be started. Review your basket and try again.";
    return { kind: "error", message };
  }
}
