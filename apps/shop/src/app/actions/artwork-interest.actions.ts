"use server";

import { commerceErrorMessage } from "@/lib/commerce-error-message";
import { fetchShopCommerceCsrfForMutation } from "@/lib/shop-commerce-mutation.server";
import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";
import {
  type ArtworkInterestIntent,
  parseRegisterArtworkInterestResponse,
} from "@auction/shop-contracts";

export async function registerArtworkInterest(
  slug: string,
  intent: ArtworkInterestIntent = "notify_me",
): Promise<
  { ok: true; status: "registered" | "already_subscribed" } | { ok: false; message: string }
> {
  const csrf = await fetchShopCommerceCsrfForMutation();
  if (!csrf.ok) {
    return {
      ok: false,
      message: commerceErrorMessage({ error: "csrf_failed" }, "Could not save your interest."),
    };
  }
  const response = await shopCommerceRequest(
    `/commerce/artworks/${encodeURIComponent(slug)}/interest`,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ intent }),
    },
    { applyCookies: true, csrfToken: csrf.token },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return {
      ok: false,
      message: commerceErrorMessage(body, "Could not save your interest. Try again shortly."),
    };
  }
  try {
    const body = parseRegisterArtworkInterestResponse(await response.json());
    return { ok: true, status: body.status };
  } catch {
    return { ok: false, message: "Could not save your interest. Try again shortly." };
  }
}
