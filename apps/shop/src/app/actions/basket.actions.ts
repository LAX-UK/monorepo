"use server";

import { commerceErrorMessage } from "@/lib/commerce-error-message";
import { fetchPublicEditionFraming } from "@/lib/shop-api.server";
import { fetchShopCommerceCsrfForMutation } from "@/lib/shop-commerce-mutation.server";
import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";
import { isShopFramingEnabled } from "@/lib/shop-runtime-flags";
import type { PublicEditionFraming } from "@auction/shop-contracts";
import { revalidatePath } from "next/cache";

export async function addMerchandiseVariantToBasket(productVariantId: string, quantity = 1) {
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
      body: JSON.stringify({ productVariantId, quantity }),
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

/**
 * Puts an edition in the basket. `framingOptionId` names the framing chosen on the edition page:
 * an option id, null for unframed, and left out where the edition has no framing to choose. Only
 * the id is sent; shop-api works out the price.
 */
export async function addArtworkToBasket(
  artworkSlug: string,
  quantity = 1,
  framingOptionId?: string | null,
) {
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
      body: JSON.stringify(
        framingOptionId === undefined
          ? { artworkSlug, quantity }
          : { artworkSlug, quantity, framingOptionId },
      ),
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

export async function setMerchandiseBasketLineQuantity(productVariantId: string, quantity: number) {
  return addMerchandiseVariantToBasket(productVariantId, quantity);
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

/** Chooses, changes or clears the framing on a print already in the basket. Only the id is sent. */
export async function setBasketLineFraming(lineId: string, framingOptionId: string | null) {
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
    `/commerce/basket/lines/${encodeURIComponent(lineId)}/framing`,
    {
      method: "PUT",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ framingOptionId }),
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

/** What an edition offers for framing, for the basket's "Change framing" sheet. */
export async function loadEditionFramingChoices(
  artworkSlug: string,
): Promise<PublicEditionFraming> {
  if (!isShopFramingEnabled()) {
    return { kind: "none", required: false, description: null, options: [] };
  }
  return fetchPublicEditionFraming(artworkSlug);
}
