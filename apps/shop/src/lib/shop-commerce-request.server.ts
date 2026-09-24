import { applyUpstreamSetCookies } from "@/lib/apply-upstream-set-cookies.server";
import {
  SHOP_COMMERCE_CSRF_COOKIE,
  shopCommerceCookieHeader,
} from "@/lib/shop-commerce-cookies.server";
import { SHOP_IDENTITY_FETCH_TIMEOUT_MS, shopIdentityServerUrl } from "@/lib/shop-identity.server";
import { cookies } from "next/headers";

export type ShopCommerceRequestOptions = {
  /** When true, persist upstream Set-Cookie on the storefront (server actions only). */
  applyCookies?: boolean;
  csrfToken?: string;
};

export async function shopCommerceRequest(
  path: string,
  init?: RequestInit,
  options: ShopCommerceRequestOptions = {},
): Promise<Response> {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = shopIdentityServerUrl(normalized);

  const cookieStore = await cookies();
  const list = cookieStore.getAll().map((entry) => ({ name: entry.name, value: entry.value }));
  let cookieHeader = shopCommerceCookieHeader(list);

  const forwardHeaders = new Headers(init?.headers);
  if (options.csrfToken) {
    forwardHeaders.set("x-shop-csrf", options.csrfToken);
    const csrfFromStore = cookieStore.get(SHOP_COMMERCE_CSRF_COOKIE)?.value;
    if (csrfFromStore) {
      const parts = cookieHeader ? cookieHeader.split("; ") : [];
      if (!parts.some((p) => p.startsWith(`${SHOP_COMMERCE_CSRF_COOKIE}=`))) {
        parts.push(`${SHOP_COMMERCE_CSRF_COOKIE}=${csrfFromStore}`);
      }
      cookieHeader = parts.join("; ");
    }
  }
  if (cookieHeader && !forwardHeaders.has("cookie")) {
    forwardHeaders.set("cookie", cookieHeader);
  }

  const response = await fetch(url, {
    ...init,
    headers: forwardHeaders,
    cache: "no-store",
    signal: AbortSignal.timeout(SHOP_IDENTITY_FETCH_TIMEOUT_MS),
  });

  if (options.applyCookies) {
    await applyUpstreamSetCookies(response);
  }

  return response;
}
