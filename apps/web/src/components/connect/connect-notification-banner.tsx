"use client";

import { ConnectNotificationBanner } from "@stripe/react-connect-js";

export function ConnectNotificationBannerPanel() {
  return (
    <div data-testid="connect-notification-banner">
      <ConnectNotificationBanner />
    </div>
  );
}
