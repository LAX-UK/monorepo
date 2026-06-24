"use client";

import { ConnectivityBannerShell } from "@/components/realtime/connectivity-banner-shell";
import { useBrowserOnline } from "@/lib/connection/use-browser-online";

/** Slim global banner when the browser reports no network connectivity. */
export function BrowserOfflineBanner() {
  const online = useBrowserOnline();
  if (online) return null;

  return (
    <ConnectivityBannerShell
      variant="fixed-top"
      tone="error"
      testId="browser-offline-banner"
      message="You are offline. Some features may be unavailable until your connection returns."
    />
  );
}
