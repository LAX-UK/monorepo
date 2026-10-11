"use server";

import { fetchShopCommerceCsrfForMutation } from "@/lib/shop-commerce-mutation.server";
import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";
import {
  type PortalPayeeConnectSurface,
  ShopContractParseError,
  parsePortalPayeeConnectSession,
} from "@auction/shop-contracts";

export type PayoutAccountSessionResult =
  | { ok: true; clientSecret: string }
  | { ok: false; reason: "sign_in_required" | "unavailable" };

/** Mints a short-lived Stripe account session for the embedded payout account components. */
export async function createPayoutAccountSession(
  surface: PortalPayeeConnectSurface,
): Promise<PayoutAccountSessionResult> {
  if (surface !== "onboarding" && surface !== "management") {
    return { ok: false, reason: "unavailable" };
  }
  const csrf = await fetchShopCommerceCsrfForMutation();
  if (!csrf.ok) return { ok: false, reason: "sign_in_required" };
  const response = await shopCommerceRequest(
    "/commerce/me/connect/account-session",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-shop-csrf": csrf.token,
      },
      body: JSON.stringify({ surface }),
    },
    { applyCookies: true },
  );
  if (response.status === 401) return { ok: false, reason: "sign_in_required" };
  if (!response.ok) return { ok: false, reason: "unavailable" };
  try {
    const { clientSecret } = parsePortalPayeeConnectSession(await response.json());
    return { ok: true, clientSecret };
  } catch (error) {
    if (error instanceof ShopContractParseError || error instanceof SyntaxError) {
      return { ok: false, reason: "unavailable" };
    }
    throw error;
  }
}
