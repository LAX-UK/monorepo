import { applyUpstreamSetCookies } from "@/lib/apply-upstream-set-cookies.server";
import { ART_COMMERCE_COOKIE_NAMES } from "@/lib/art-commerce-cookies.server";
import { ART_IDENTITY_FETCH_TIMEOUT_MS, artIdentityServerUrl } from "@/lib/art-identity.server";
import { type CommerceBffRequestOptions, createCommerceBffClient } from "@auction/shop-portal/bff";
import { cookies, headers } from "next/headers";

export type ArtCommerceRequestOptions = CommerceBffRequestOptions;

const commerceBffClient = createCommerceBffClient({
  resolveUrl: artIdentityServerUrl,
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
  commerceCookieNames: ART_COMMERCE_COOKIE_NAMES,
  timeoutMs: ART_IDENTITY_FETCH_TIMEOUT_MS,
  applyUpstreamSetCookies,
  requestHeaders: headers,
});

export async function artCommerceRequest(
  path: string,
  init?: RequestInit,
  options: ArtCommerceRequestOptions = {},
): Promise<Response> {
  return commerceBffClient.request(path, init, options);
}
