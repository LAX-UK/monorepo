"use client";

import type { NotificationSwitchToastView } from "@/lib/navigation/account-notice";
import { clearAccountNotice } from "@/lib/navigation/account-notice-cookie.client";
import { pageAfterSwitch } from "@/lib/navigation/account-page-map";
import { Button } from "@auction/ui/lax";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { AccountToast } from "./account-toast";
import { useAccountSwitch } from "./use-account-switch";

/** Long enough to read and reach "Switch back"; it stays while hovered or focused. */
const SHOWN_MS = 12_000;

/**
 * "Now acting as Cedar & Stone Fine Art": opening a notification for another account switched to
 * it. The toast names the account and offers "Switch back", which opens the page the other account
 * has for this one (its list, or its Home from a record, which only the account just left can
 * open). It clears its cookie at once, so it never repeats.
 */
export function NotificationSwitchToast({
  account,
  fromAccountId,
  fromKind,
}: NotificationSwitchToastView) {
  const pathname = usePathname();
  const { pendingId, choose } = useAccountSwitch(pageAfterSwitch(pathname, fromKind));

  useEffect(() => clearAccountNotice(), []);

  return (
    <AccountToast
      account={account}
      title={`Now acting as ${account.name}`}
      detail="You opened a notification for that account."
      autoDismissMs={SHOWN_MS}
      testId="notification-switch-toast"
      action={
        <Button
          size="sm"
          className="shrink-0 max-sm:min-h-11"
          aria-busy={pendingId !== null || undefined}
          disabled={pendingId !== null}
          onClick={() => void choose({ id: fromAccountId, current: false, kind: fromKind })}
        >
          Switch back
        </Button>
      }
    />
  );
}
