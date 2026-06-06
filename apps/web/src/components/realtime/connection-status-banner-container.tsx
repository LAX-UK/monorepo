"use client";

import { ConnectionStatusBanner } from "@/components/realtime/connection-status-banner";
import { useLiveConnection } from "@/lib/connection/use-live-connection";

export function ConnectionStatusBannerContainer({ className }: { className?: string }) {
  const { state, message } = useLiveConnection();
  return (
    <ConnectionStatusBanner
      state={state}
      message={message}
      {...(className !== undefined ? { className } : {})}
    />
  );
}
