import { LAX_ACCOUNT_PATHS, laxAccountUrl } from "@/lib/lax-account-url";
import type { ShopViewerState } from "@/lib/shop-viewer-state";
import { shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { safeRelativeReturnPath } from "@auction/identity-rp/safe-return-path";

/** Shop's account area is "Your orders"; `/account` is only an entry point to it. */
export const SHOP_ORDERS_HREF = "/account/orders";

export function shopOrderHref(orderId: string): string {
  return `${SHOP_ORDERS_HREF}/${encodeURIComponent(orderId)}`;
}

/** Shop account pages whose content now lives in LAX Account or on lax.art. */
export type RetiredShopAccountPage = "collection" | "editions" | "documents" | "enquiries";

/**
 * Where a retired Shop account page now lives. Collection and documents are the LAX Account
 * portfolio (documents sit on each work); editions are the portfolio filtered to Shop; enquiries
 * are lax.art conversations. Without a lax.art URL, enquiries fall back to the orders page.
 */
export function retiredShopAccountPageDestination(
  page: RetiredShopAccountPage,
  artBaseUrl: string | null,
): string {
  switch (page) {
    case "collection":
    case "documents":
      return laxAccountUrl(LAX_ACCOUNT_PATHS.portfolio);
    case "editions":
      return laxAccountUrl(LAX_ACCOUNT_PATHS.shopPortfolio);
    case "enquiries":
      return artBaseUrl ? `${artBaseUrl.replace(/\/+$/, "")}/account/enquiries` : SHOP_ORDERS_HREF;
  }
}

export type ShopAccountEntryParams = {
  returnTo?: string | undefined;
  merged?: string | undefined;
  basketMerge?: string | undefined;
};

const BASKET_MERGE_OUTCOMES = new Set(["merged", "skipped", "failed"]);

/**
 * Where `/account` sends the viewer. Signing in lands here, so an authenticated visit first runs
 * the basket merge (`/account/post-sign-in`) and then continues to the return path or the orders
 * page, carrying the merge outcome for the basket notice.
 */
export function resolveShopAccountEntryRedirect(
  viewer: ShopViewerState,
  params: ShopAccountEntryParams,
): string {
  const destination = safeRelativeReturnPath(params.returnTo) ?? SHOP_ORDERS_HREF;
  switch (viewer.kind) {
    case "disabled":
      return viewer.accountHref ?? "/account/disabled";
    case "guest":
      return shopStorefrontLoginHref(destination);
    case "unavailable":
      return SHOP_ORDERS_HREF;
    case "authenticated": {
      const outcome = params.basketMerge;
      const mergeDone = params.merged === "1" || (outcome && BASKET_MERGE_OUTCOMES.has(outcome));
      if (!mergeDone) {
        return `/account/post-sign-in?${new URLSearchParams({ returnTo: destination }).toString()}`;
      }
      if (!outcome || !BASKET_MERGE_OUTCOMES.has(outcome)) return destination;
      const url = new URL(destination, "http://shop.invalid");
      url.searchParams.set("basketMerge", outcome);
      return `${url.pathname}${url.search}${url.hash}`;
    }
  }
}
