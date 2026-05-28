"use client";

import { useConsent } from "@/lib/analytics/consent/context";
import {
  type BottomChromeState,
  consentOffset,
  isDashboardTabBarRoute,
  isFixedPayBarRoute,
  isHideDashboardTabBarRoute,
  isMarketingBidBarRoute,
  pageBottomPadding,
} from "@/lib/layout/bottom-chrome";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

export function useBottomChromeState(): BottomChromeState {
  const pathname = usePathname();
  const { showBanner } = useConsent();

  return useMemo(
    () => ({
      consentBannerVisible: showBanner,
      dashboardTabBarActive: isDashboardTabBarRoute(pathname),
      marketingBidBarRoute: isMarketingBidBarRoute(pathname),
      fixedPayBarRoute: isFixedPayBarRoute(pathname),
      hideDashboardTabBar: isHideDashboardTabBarRoute(pathname),
    }),
    [pathname, showBanner],
  );
}

/** CSS variable values for fixed bottom chrome layering. */
export function useBottomChromeVars(): Record<string, string> {
  const state = useBottomChromeState();

  return useMemo(() => {
    const consent = consentOffset(state.consentBannerVisible);
    return {
      "--bottom-chrome-consent-offset": consent,
      "--sticky-bid-bar-bottom": consent,
      "--bottom-tab-bar-bottom": consent,
      "--page-bottom-padding": pageBottomPadding(state),
    };
  }, [state]);
}
