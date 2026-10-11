"use server";

import { fetchArtCommerceCsrfForMutation } from "@/lib/art-commerce-mutation.server";
import { artCommerceRequest } from "@/lib/art-commerce-request.server";
import { isArtPayoutsEnabled } from "@/lib/art-runtime-flags";
import {
  type PortalPayeeConnectSurface,
  ShopContractParseError,
  parsePortalPayeeConnectSession,
} from "@auction/shop-contracts";
import type { PayoutAccountSessionResult } from "@auction/shop-portal/react";

export async function createArtPayoutAccountSession(
  surface: PortalPayeeConnectSurface,
): Promise<PayoutAccountSessionResult> {
  if (!isArtPayoutsEnabled()) return { ok: false, reason: "unavailable" };
  if (surface !== "onboarding" && surface !== "management") {
    return { ok: false, reason: "unavailable" };
  }
  const csrf = await fetchArtCommerceCsrfForMutation();
  if (!csrf.ok) return { ok: false, reason: "sign_in_required" };
  const response = await artCommerceRequest(
    "/commerce/me/connect/account-session",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ surface }),
    },
    { applyCookies: true, csrfToken: csrf.token },
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
