"use client";

import { ConnectNotificationBanner } from "@stripe/react-connect-js";

type Props = {
  onNotificationsChange?: (notifications: { actionRequired: number }) => void;
};

export function ConnectNotificationBannerPanel({ onNotificationsChange }: Props) {
  return (
    <div data-testid="connect-notification-banner">
      <ConnectNotificationBanner
        collectionOptions={{ fields: "eventually_due", futureRequirements: "include" }}
        onNotificationsChange={onNotificationsChange}
      />
    </div>
  );
}
