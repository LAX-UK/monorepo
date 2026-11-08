"use server";

import { checkoutReturnUrls } from "@/lib/checkout/checkout-return-urls.server";
import { orderCommercePath } from "@/lib/checkout/order-commerce-path.server";
import { commerceErrorMessage } from "@/lib/commerce-error-message";
import { fetchShopCommerceCsrfForMutation } from "@/lib/shop-commerce-mutation.server";
import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";
import { ShopContractParseError, parseCheckoutSession } from "@auction/shop-contracts";

export async function resumeCheckoutPayment(
  orderId: string,
): Promise<{ kind: "redirect"; checkoutUrl: string } | { kind: "error"; message: string }> {
  const csrf = await fetchShopCommerceCsrfForMutation();
  if (!csrf.ok) {
    return {
      kind: "error",
      message: commerceErrorMessage({ error: "csrf_failed" }, "Could not resume checkout."),
    };
  }
  const { successUrl, cancelUrl } = checkoutReturnUrls();
  const response = await shopCommerceRequest(
    await orderCommercePath(orderId, "resume-checkout"),
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        successUrl,
        cancelUrl,
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
        "We could not reopen your payment session. Try again from your basket.",
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
        : "We could not reopen your payment session.";
    return { kind: "error", message };
  }
}
