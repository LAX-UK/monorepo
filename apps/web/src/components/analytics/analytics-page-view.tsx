"use client";

import { trackPageView } from "@/lib/analytics/events";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/** Fires `page_view` on App Router client navigations (GTM does not do this automatically). */
export function AnalyticsPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    const qs = searchParams?.toString();
    const key = qs ? `${pathname}?${qs}` : pathname;
    if (lastKey.current === key) return;
    lastKey.current = key;
    trackPageView(key);
  }, [pathname, searchParams]);

  return null;
}
