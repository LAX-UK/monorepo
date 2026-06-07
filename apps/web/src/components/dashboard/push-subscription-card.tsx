"use client";

import { IosInstallSheet } from "@/components/pwa/ios-install-sheet";
import { updateNotificationPreferencesFromValuesAction } from "@/lib/actions/user-notification-preferences";
import { needsIosInstallForPush } from "@/lib/push/capability";
import { usePushSubscription } from "@/lib/push/use-push-subscription";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import { Bell, BellOff, BellRing, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  saveDisabled?: boolean;
  /** When true, enabling push also turns on outbid + won push prefs. */
  enableDefaultPrefs?: boolean;
};

export function PushSubscriptionCard({ saveDisabled = false, enableDefaultPrefs = true }: Props) {
  const router = useRouter();
  const [iosSheetOpen, setIosSheetOpen] = useState(false);
  const {
    supported,
    permission,
    hasBrowserSubscription,
    hasServerSubscription,
    loading,
    busy,
    enable,
    disable,
  } = usePushSubscription();

  const isActive = hasBrowserSubscription && permission === "granted";
  const staleServerOnly = hasServerSubscription && !hasBrowserSubscription;
  const needsEnable =
    !isActive && permission !== "denied" && (permission === "default" || staleServerOnly);

  const onEnable = async () => {
    if (needsIosInstallForPush()) {
      setIosSheetOpen(true);
      return;
    }
    try {
      await enable();
      if (enableDefaultPrefs) {
        const r = await updateNotificationPreferencesFromValuesAction({
          outbidPush: true,
          wonPush: true,
        });
        if (!r.ok) {
          try {
            await disable();
          } catch {
            // Best-effort rollback when prefs sync fails.
          }
          notify.error(
            `Push was enabled but notification preferences could not sync. ${r.error ?? "Try again from notification settings."}`,
          );
          router.refresh();
          return;
        }
      }
      notify.success("Browser notifications enabled");
      router.refresh();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Could not enable push");
    }
  };

  const onDisable = async () => {
    try {
      await disable();
      notify.success("Browser notifications disabled");
      router.refresh();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Could not disable push");
    }
  };

  if (loading) {
    return (
      <Surface variant="card" className="mt-4 p-4">
        <p className="font-body text-sm text-on-surface-variant">Checking push status…</p>
      </Surface>
    );
  }

  if (!supported) {
    return (
      <Surface variant="card" className="mt-4 p-4">
        <div className="flex items-start gap-3">
          <BellOff className="mt-0.5 size-4 shrink-0 text-on-surface-variant" aria-hidden />
          <div>
            <p className="font-body text-sm font-medium text-on-surface">
              Browser push not supported
            </p>
            <p className="mt-1 font-body text-xs text-on-surface-variant">
              This browser cannot receive web push alerts. Use in-app or email notifications
              instead.
            </p>
          </div>
        </div>
      </Surface>
    );
  }

  if (permission === "denied") {
    return (
      <Surface variant="card" className="mt-4 border-error/30 p-4">
        <div className="flex items-start gap-3">
          <BellOff className="mt-0.5 size-4 shrink-0 text-error" aria-hidden />
          <div>
            <p className="font-body text-sm font-medium text-on-surface">Notifications blocked</p>
            <p className="mt-1 font-body text-xs text-on-surface-variant">
              Re-enable notifications for this site in your browser settings, then return here.
            </p>
          </div>
        </div>
      </Surface>
    );
  }

  return (
    <>
      <Surface variant="card" className="mt-4 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            {isActive ? (
              <BellRing className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            ) : (
              <Bell className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            )}
            <div>
              <p className="font-body text-sm font-medium text-on-surface">
                {isActive ? "Browser push enabled" : "Get outbid alerts on this device"}
              </p>
              <p className="mt-1 font-body text-xs text-on-surface-variant">
                {isActive
                  ? "You will receive push notifications for enabled alert types."
                  : "Enable push to be notified when you are outbid or win a lot — even when LAX is in the background."}
              </p>
              {needsIosInstallForPush() ? (
                <p className="mt-2 flex items-center gap-1.5 font-body text-xs text-amber-800 dark:text-amber-200">
                  <Smartphone className="size-3.5 shrink-0" aria-hidden />
                  Add LAX to your home screen first (required on iPhone).
                </p>
              ) : null}
              {needsEnable ? (
                <p className="mt-2 font-body text-xs text-amber-800 dark:text-amber-200">
                  {staleServerOnly
                    ? "Push is registered on another device or session — enable on this device to receive alerts here."
                    : "Push toggles will not deliver until you enable browser notifications."}
                </p>
              ) : null}
            </div>
          </div>
          <div className="shrink-0">
            {isActive ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy || saveDisabled}
                onClick={() => void onDisable()}
                className="h-auto rounded-md px-4 py-3 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]"
              >
                {busy ? "Working…" : "Disable push"}
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                disabled={busy || saveDisabled}
                onClick={() => void onEnable()}
                className="h-auto min-h-11 px-4 py-3 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]"
              >
                {busy ? "Working…" : "Enable browser push"}
              </Button>
            )}
          </div>
        </div>
      </Surface>
      <IosInstallSheet open={iosSheetOpen} onOpenChange={setIosSheetOpen} />
    </>
  );
}
