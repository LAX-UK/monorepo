"use client";

import { ConnectivityBannerShell } from "@/components/realtime/connectivity-banner-shell";
import { useBrowserOnline } from "@/lib/connection/use-browser-online";
import { useLiveConnectionPresentation } from "@/lib/connection/use-live-connection-presentation";

type Props = {
  enabled?: boolean;
};

/** Fixed-top live connectivity banner for saleroom catalog pages. */
export function MarketingLiveConnectivityBanner({ enabled = true }: Props) {
  const browserOnline = useBrowserOnline();
  const { state, message } = useLiveConnectionPresentation("saleroom");

  if (!enabled || !browserOnline || state === "live" || !message) return null;

  return (
    <ConnectivityBannerShell
      variant="fixed-top"
      tone={state === "offline" ? "error" : "warning"}
      testId="marketing-live-connectivity-banner"
      message={message}
    />
  );
}
