"use server";

import { commerceErrorMessage } from "@/lib/commerce-error-message";
import { fetchShopCommerceCsrfForMutation } from "@/lib/shop-commerce-mutation.server";
import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";
import { revalidatePath } from "next/cache";

export async function addArtworkToBasket(artworkSlug: string, quantity = 1) {
  const csrf = await fetchShopCommerceCsrfForMutation();
  if (!csrf.ok) {
    return {
      ok: false as const,
      error: {
        message: commerceErrorMessage({ error: "csrf_failed" }, "Could not update basket."),
      },
    };
  }
  const response = await shopCommerceRequest(
    "/commerce/basket/lines",
    {
      method: "PUT",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ artworkSlug, quantity }),
    },
    { applyCookies: true, csrfToken: csrf.token },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return { ok: false as const, error: body };
  }
  revalidatePath("/basket");
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function removeBasketLine(lineId: string) {
  const csrf = await fetchShopCommerceCsrfForMutation();
  if (!csrf.ok) {
    return {
      ok: false as const,
      error: {
        message: commerceErrorMessage({ error: "csrf_failed" }, "Could not update basket."),
      },
    };
  }
  const response = await shopCommerceRequest(
    `/commerce/basket/lines/${encodeURIComponent(lineId)}`,
    {
      method: "DELETE",
      headers: { accept: "application/json" },
    },
    { applyCookies: true, csrfToken: csrf.token },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return { ok: false as const, error: body };
  }
  revalidatePath("/basket");
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function setBasketLineQuantity(artworkSlug: string, quantity: number) {
  const csrf = await fetchShopCommerceCsrfForMutation();
  if (!csrf.ok) {
    return {
      ok: false as const,
      error: {
        message: commerceErrorMessage({ error: "csrf_failed" }, "Could not update basket."),
      },
    };
  }
  const response = await shopCommerceRequest(
    "/commerce/basket/lines",
    {
      method: "PUT",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ artworkSlug, quantity }),
    },
    { applyCookies: true, csrfToken: csrf.token },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return { ok: false as const, error: body };
  }
  revalidatePath("/basket");
  revalidatePath("/", "layout");
  return { ok: true as const };
}
