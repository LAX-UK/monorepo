"use client";

import { useConsent } from "@/lib/analytics/consent/context";
import { trackPageView } from "@/lib/analytics/events";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/** Fires `page_view` on App Router client navigations (GTM does not do this automatically). */
export function AnalyticsPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { snapshot } = useConsent();
  const analytics = snapshot?.analytics === true;
  const lastKey = useRef<string | null>(null);

  // Re-fire on consent transition false→true so the first page-view after the
  // banner is accepted lands in GA4 without requiring another navigation.
  useEffect(() => {
    if (!analytics) return;
    const qs = searchParams?.toString();
    const key = qs ? `${pathname}?${qs}` : pathname;
    if (lastKey.current === key) return;
    lastKey.current = key;
    trackPageView(key);
  }, [pathname, searchParams, analytics]);

  return null;
}
