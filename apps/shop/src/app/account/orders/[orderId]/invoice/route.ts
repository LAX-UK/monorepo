import { shopOrderHref } from "@/lib/account/shop-account-routes";
import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";
import { shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { redirect } from "next/navigation";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The invoice PDF of a paid order, fetched for the signed-in shopper and passed on as a download.
 * A signed-out visit goes to sign-in and back to the order; anything else that fails returns to
 * the order page, which explains what is available.
 */
export async function GET(_request: Request, context: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await context.params;
  if (!UUID_PATTERN.test(orderId)) {
    return new Response("Not found", { status: 404 });
  }
  const orderHref = shopOrderHref(orderId);
  const response = await shopCommerceRequest(
    `/commerce/orders/${encodeURIComponent(orderId)}/invoice`,
    { headers: { accept: "application/pdf" } },
  ).catch(() => null);

  if (response?.status === 401) redirect(shopStorefrontLoginHref(orderHref));
  if (!response?.ok || response.headers.get("content-type") !== "application/pdf") {
    redirect(orderHref);
  }

  const headers = new Headers({
    "content-type": "application/pdf",
    "cache-control": "private, no-store",
  });
  const disposition = response.headers.get("content-disposition");
  if (disposition) headers.set("content-disposition", disposition);
  return new Response(response.body, { status: 200, headers });
}
