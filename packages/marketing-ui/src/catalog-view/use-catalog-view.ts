"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useSyncExternalStore, useTransition } from "react";
import {
  readMarketingViewParam,
  replaceMarketingViewUrl,
  subscribeMarketingViewUrl,
} from "./catalog-view-url-store.js";
import { buildViewHref, writeViewPreferenceCookie } from "./catalog-view.js";

/**
 * Live layout view from the URL query string. `history.replaceState` updates (see
 * `useCatalogViewNavigation`) avoid RSC refetches that remount the page and reset scroll.
 */
export function useCatalogLayoutView(defaultView: string, serverView: string): string {
  return useSyncExternalStore(
    subscribeMarketingViewUrl,
    () => readMarketingViewParam(defaultView, serverView),
    () => serverView,
  );
}

export type UseCatalogViewNavigationOptions = {
  routeKey: string;
  /** URL param value to omit from the query string (canonical default). */
  defaultView: string;
  /** Map UI view → cookie value when they differ (e.g. sales calendar). */
  toCookieValue?: (view: string) => string;
  /** Params removed on view change; defaults to offset pagination keys. */
  clearParams?: readonly string[];
};

export function useCatalogViewNavigation({
  routeKey,
  defaultView,
  toCookieValue,
  clearParams,
}: UseCatalogViewNavigationOptions) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const navigate = useCallback(
    (nextView: string) => {
      startTransition(() => {
        const href = buildViewHref(pathname, searchParams, nextView, {
          defaultView,
          ...(clearParams ? { clearParams } : {}),
        });
        writeViewPreferenceCookie(routeKey, toCookieValue?.(nextView) ?? nextView);
        replaceMarketingViewUrl(href, nextView);
      });
    },
    [clearParams, defaultView, pathname, routeKey, searchParams, toCookieValue],
  );

  return { navigate, pending };
}
