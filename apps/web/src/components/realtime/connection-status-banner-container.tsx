"use client";

import { ConnectionStatusBanner } from "@/components/realtime/connection-status-banner";
import type { LiveConnectivityScope } from "@/lib/connection/live-connectivity-copy";
import { useBrowserOnline } from "@/lib/connection/use-browser-online";
import { useLiveConnectionPresentation } from "@/lib/connection/use-live-connection-presentation";

type Props = {
  scope?: LiveConnectivityScope;
  className?: string;
};

export function ConnectionStatusBannerContainer({ scope = "bidding", className }: Props) {
  const browserOnline = useBrowserOnline();
  const { state, message } = useLiveConnectionPresentation(scope);

  if (!browserOnline || !message) return null;

  return (
    <ConnectionStatusBanner
      state={state}
      message={message}
      {...(className !== undefined ? { className } : {})}
    />
  );
}
