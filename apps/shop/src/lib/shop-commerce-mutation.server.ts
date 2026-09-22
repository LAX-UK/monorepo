import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";

export type CommerceCsrfResult = { ok: true; token: string } | { ok: false };

export async function fetchShopCommerceCsrfForMutation(): Promise<CommerceCsrfResult> {
  const response = await shopCommerceRequest("/commerce/csrf", {}, { applyCookies: true });
  if (!response.ok) return { ok: false };
  const body = (await response.json()) as { csrfToken?: string };
  const token = typeof body.csrfToken === "string" ? body.csrfToken : "";
  if (!token) return { ok: false };
  return { ok: true, token };
}
