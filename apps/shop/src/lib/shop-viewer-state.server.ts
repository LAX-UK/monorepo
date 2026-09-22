import {
  fetchShopIdentityMe,
  shopIdentityCookieHeader,
  shopIdentityUrl,
} from "@/lib/shop-identity.server";
import {
  type ShopViewerDestinations,
  type ShopViewerState,
  toShopViewerState,
} from "@/lib/shop-viewer-state";
import { cookies } from "next/headers";
import { cache } from "react";

function shopViewerDestinations(): ShopViewerDestinations {
  return {
    loginHref: shopIdentityUrl("/login"),
    registerHref: "/register",
    accountHref: "/account",
    logoutHref: shopIdentityUrl("/logout"),
    disabledAccountHref: "/account/disabled",
  };
}

export const loadShopViewerState = cache(async (): Promise<ShopViewerState> => {
  const cookieStore = await cookies();
  const cookieHeader = shopIdentityCookieHeader(cookieStore.getAll());
  const result = await fetchShopIdentityMe(cookieHeader);
  return toShopViewerState(result, shopViewerDestinations());
});
