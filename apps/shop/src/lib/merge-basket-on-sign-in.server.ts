import { fetchShopCommerceCsrfForMutation } from "@/lib/shop-commerce-mutation.server";
import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";

export type MergeBasketOnSignInResult = { ok: true; merged: boolean } | { ok: false };

/** Persist commerce cookies after sign-in (route handlers and server actions only). */
export async function mergeBasketOnSignIn(): Promise<MergeBasketOnSignInResult> {
  try {
    const csrf = await fetchShopCommerceCsrfForMutation();
    if (!csrf.ok) return { ok: false };
    const response = await shopCommerceRequest(
      "/commerce/basket/merge-on-sign-in",
      {
        method: "POST",
        headers: { accept: "application/json" },
      },
      { applyCookies: true, csrfToken: csrf.token },
    );
    if (!response.ok) return { ok: false };
    const body = (await response.json().catch(() => null)) as { merged?: boolean } | null;
    return { ok: true, merged: body?.merged === true };
  } catch {
    return { ok: false };
  }
}
