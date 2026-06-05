"use client";

import { buildViewHref, writeViewPreferenceCookie } from "@/lib/preferences/view-query-navigation";
import { replaceMarketingViewUrl } from "@/lib/preferences/view-url-store";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

export type UseViewQueryNavigationOptions = {
  routeKey: string;
  /** URL param value to omit from the query string (canonical default). */
  defaultView: string;
  /** Map UI view → cookie value when they differ (e.g. sales calendar). */
  toCookieValue?: (view: string) => string;
};

/**
 * Shared marketing catalogue view navigation:
 * - URL remains source of truth (SEO + shareable links)
 * - `history.replaceState` (no App Router refetch — critical for authed dynamic pages)
 * - Per-route preference cookie
 * - `startTransition` for pending UI state
 */
export function useViewQueryNavigation({
  routeKey,
  defaultView,
  toCookieValue,
}: UseViewQueryNavigationOptions) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const navigate = useCallback(
    (nextView: string) => {
      startTransition(() => {
        const href = buildViewHref(pathname, searchParams, nextView, { defaultView });
        writeViewPreferenceCookie(routeKey, toCookieValue?.(nextView) ?? nextView);
        replaceMarketingViewUrl(href, nextView);
      });
    },
    [defaultView, pathname, routeKey, searchParams, toCookieValue],
  );

  return { navigate, pending };
}
