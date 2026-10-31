"use client";

import { IosInstallSheet } from "@/components/pwa/ios-install-sheet";
import { needsIosInstallForPush } from "@/lib/push/capability";
import { devicePushView } from "@/lib/push/device-push.vm";
import { usePushSubscription } from "@/lib/push/use-push-subscription";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/lax";
import { useState } from "react";

/**
 * "App alerts on this device" under the matrix: one row, as the matrix's rows read (label, one
 * line, one action). It turns this browser's push subscription on or off; when the browser
 * can't do push or blocks it, it says so and offers nothing to press.
 */
export function DevicePushRow() {
  const push = usePushSubscription();
  const [iosSheetOpen, setIosSheetOpen] = useState(false);
  const needsHomeScreen = needsIosInstallForPush();
  const view = devicePushView(push, { needsHomeScreen });

  const turnOn = async () => {
    if (needsHomeScreen) {
      setIosSheetOpen(true);
      return;
    }
    try {
      await push.enable();
      notify.success("App alerts are on for this device");
    } catch {
      notify.error("We couldn't turn on app alerts here", {
        description: "Check that this site may show notifications, then try again.",
      });
    }
  };
  const turnOff = async () => {
    try {
      await push.disable();
      notify.success("App alerts are off for this device");
    } catch {
      notify.error("We couldn't turn off app alerts here. Try again.");
    }
  };

  return (
    <>
      <div className="flex flex-col gap-3 rounded-lax-card border border-lax-line bg-lax-surface px-4 py-3 sm:flex-row sm:items-center md:px-5">
        <div className="min-w-0 flex-1">
          <p className="text-lax-14 font-medium text-lax-fg">
            App alerts on this device
            <span className="font-normal text-lax-muted"> · {view.status}</span>
          </p>
          <p className="text-lax-13 text-lax-muted">{view.detail}</p>
        </div>
        {view.action === "turn_on" ? (
          <Button loading={push.busy} onClick={() => void turnOn()} className="max-sm:w-full">
            Turn on
          </Button>
        ) : view.action === "turn_off" ? (
          <Button loading={push.busy} onClick={() => void turnOff()} className="max-sm:w-full">
            Turn off
          </Button>
        ) : null}
      </div>
      <IosInstallSheet open={iosSheetOpen} onOpenChange={setIosSheetOpen} />
    </>
  );
}
