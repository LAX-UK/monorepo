import { GUEST_ORDER_PATH } from "@/lib/checkout/guest-order.vm";
import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";
import { redirect } from "next/navigation";

/**
 * The VAT invoice of the guest's paid order, the same document an account order has. Anything
 * that fails returns to the order page, which says what is available.
 */
export async function GET() {
  const response = await shopCommerceRequest("/commerce/guest-orders/current/invoice", {
    headers: { accept: "application/pdf" },
  }).catch(() => null);
  if (!response?.ok || response.headers.get("content-type") !== "application/pdf") {
    redirect(GUEST_ORDER_PATH);
  }
  const headers = new Headers({
    "content-type": "application/pdf",
    "cache-control": "private, no-store",
  });
  const disposition = response.headers.get("content-disposition");
  if (disposition) headers.set("content-disposition", disposition);
  return new Response(response.body, { status: 200, headers });
}
