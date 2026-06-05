"use client";

import { buildViewHref, writeViewPreferenceCookie } from "@/lib/preferences/view-query-navigation";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
 * - `router.replace` with `scroll: false` (no jump to top)
 * - Per-route preference cookie
 * - `startTransition` for pending UI state
 */
export function useViewQueryNavigation({
  routeKey,
  defaultView,
  toCookieValue,
}: UseViewQueryNavigationOptions) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const navigate = useCallback(
    (nextView: string) => {
      startTransition(() => {
        const href = buildViewHref(pathname, searchParams, nextView, { defaultView });
        writeViewPreferenceCookie(routeKey, toCookieValue?.(nextView) ?? nextView);
        router.replace(href, { scroll: false });
      });
    },
    [defaultView, pathname, routeKey, router, searchParams, toCookieValue],
  );

  return { navigate, pending };
}
