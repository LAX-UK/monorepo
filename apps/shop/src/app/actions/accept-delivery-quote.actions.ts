"use server";

import { checkoutReturnUrls } from "@/lib/checkout/checkout-return-urls.server";
import { orderCommercePath } from "@/lib/checkout/order-commerce-path.server";
import { commerceErrorMessage } from "@/lib/commerce-error-message";
import { fetchShopCommerceCsrfForMutation } from "@/lib/shop-commerce-mutation.server";
import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";
import { ShopContractParseError, parseCheckoutSession } from "@auction/shop-contracts";

/**
 * The shopper accepts the gallery's delivery quote for their order. The order is priced with the
 * delivery on the server, and the answer is the secure payment page to go to.
 */
export async function acceptDeliveryQuote(
  orderId: string,
): Promise<{ kind: "redirect"; checkoutUrl: string } | { kind: "error"; message: string }> {
  const csrf = await fetchShopCommerceCsrfForMutation();
  if (!csrf.ok) {
    return {
      kind: "error",
      message: commerceErrorMessage({ error: "csrf_failed" }, "Could not accept the quote."),
    };
  }
  const { successUrl, cancelUrl } = checkoutReturnUrls();
  const response = await shopCommerceRequest(
    await orderCommercePath(orderId, "accept-delivery-quote"),
    {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ successUrl, cancelUrl }),
    },
    { applyCookies: true, csrfToken: csrf.token },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return {
      kind: "error",
      message: commerceErrorMessage(
        body,
        "We could not accept this quote. Try again, or contact us and we will help.",
      ),
    };
  }
  try {
    const session = parseCheckoutSession(await response.json());
    return { kind: "redirect", checkoutUrl: session.checkoutUrl };
  } catch (error) {
    return {
      kind: "error",
      message:
        error instanceof ShopContractParseError
          ? "Payment returned an unexpected response. Try again shortly."
          : "We could not open payment.",
    };
  }
}
