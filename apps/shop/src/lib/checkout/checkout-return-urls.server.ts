import { loadShopStorefrontBaseUrl } from "@/lib/ecosystem/product-directory.server";

/**
 * Where Stripe sends the shopper back to. Built from the configured public storefront URL, never
 * from request headers: `x-forwarded-host` is set by whoever makes the request, so a header-built
 * return URL could send a paying shopper (and their order id) to another site.
 */
export function checkoutReturnUrls(): { successUrl: string; cancelUrl: string } {
  const origin = loadShopStorefrontBaseUrl().origin;
  return {
    successUrl: `${origin}/checkout/confirmation?orderId={ORDER_ID}`,
    cancelUrl: `${origin}/checkout/cancel?orderId={ORDER_ID}`,
  };
}
