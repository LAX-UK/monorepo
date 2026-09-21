"use server";

import { fetchShopCommerceCsrfForMutation } from "@/lib/shop-commerce-mutation.server";
import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";

export async function abandonCheckout(orderId: string): Promise<void> {
  const csrf = await fetchShopCommerceCsrfForMutation();
  if (!csrf.ok) {
    return;
  }
  await shopCommerceRequest(
    `/commerce/orders/${encodeURIComponent(orderId)}/cancel`,
    {
      method: "POST",
      headers: {
        accept: "application/json",
      },
    },
    { applyCookies: true, csrfToken: csrf.token },
  );
}
