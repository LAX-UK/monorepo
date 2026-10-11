import { applyUpstreamSetCookies } from "@/lib/apply-upstream-set-cookies.server";
import { SHOP_COMMERCE_COOKIE_NAMES } from "@/lib/shop-commerce-cookies.server";
import { SHOP_IDENTITY_FETCH_TIMEOUT_MS, shopIdentityServerUrl } from "@/lib/shop-identity.server";
import { type CommerceBffRequestOptions, createCommerceBffClient } from "@auction/shop-portal/bff";
import { cookies } from "next/headers";

export type ShopCommerceRequestOptions = CommerceBffRequestOptions;

const commerceBffClient = createCommerceBffClient({
  resolveUrl: shopIdentityServerUrl,
  cookiePort: {
    readAll: async () => {
      const cookieStore = await cookies();
      return cookieStore.getAll().map((entry) => ({ name: entry.name, value: entry.value }));
    },
    read: async (name: string) => {
      const cookieStore = await cookies();
      return cookieStore.get(name)?.value;
    },
  },
  commerceCookieNames: SHOP_COMMERCE_COOKIE_NAMES,
  timeoutMs: SHOP_IDENTITY_FETCH_TIMEOUT_MS,
  applyUpstreamSetCookies,
});

export async function shopCommerceRequest(
  path: string,
  init?: RequestInit,
  options: ShopCommerceRequestOptions = {},
): Promise<Response> {
  return commerceBffClient.request(path, init, options);
}
