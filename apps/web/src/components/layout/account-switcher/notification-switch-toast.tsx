"use client";

import type { NotificationSwitchToastView } from "@/lib/navigation/account-notice";
import { SwitchBackToast } from "./switch-back-toast";

/**
 * "Now acting as Cedar & Stone Fine Art": opening a notification for another account switched to
 * it. The toast names the account and offers "Switch back".
 */
export function NotificationSwitchToast({
  account,
  fromAccountId,
  fromKind,
}: NotificationSwitchToastView) {
  return (
    <SwitchBackToast
      account={account}
      title={`Now acting as ${account.name}`}
      detail="You opened a notification for that account."
      backLabel="Switch back"
      fromKind={fromKind}
      fromAccountId={fromAccountId}
      testId="notification-switch-toast"
    />
  );
}
