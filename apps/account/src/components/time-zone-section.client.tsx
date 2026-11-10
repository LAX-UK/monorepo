"use client";

import { Button, LoadingButton } from "@/components/account-button";
import { CARD, CARD_PADDING, ListCard, ListCardRow } from "@/components/account-ui";
import {
  reportDeviceZoneAction,
  saveTimeZoneAction,
} from "@/server/application/account-identity-actions.server";
import type { TimeZoneActionResult } from "@/server/domain/account-action-result";
import { buildReauthHref } from "@/server/domain/account-reauth";
import {
  type TimeZonePreferenceVm,
  deviceZoneOffer,
  shouldReportDeviceZone,
  toTimeZonePreferenceVm,
  zoneLabel,
} from "@/server/domain/account-time-zone.vm";
import { cityName, deviceTimeZone } from "@auction/datetime";
import {
  ChangeZoneDialog,
  type SavedZone,
  type ZonePreferencePort,
  ZonePreferenceProvider,
} from "@auction/ui/time";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

type TimeZoneSectionProps = {
  /** What the issuer holds; null when it could not be reached. */
  initial: { mode: "automatic" | "fixed"; zone: string | null } | null;
  /** The moment zone labels are written for, fixed by the server so hydration agrees. */
  at: string;
  /** Where to come back to if the person has to sign in again. */
  returnTo: string;
};

const SAVED_NOTE =
  "Saved to your LAX Account. We use it in your emails and in the times LAX Bid shows you.";

const noSubscription = () => () => {};
/** False while the page hydrates, true after: the device's zone is only known in the browser. */
function useBrowserReady(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
}

/**
 * Personal details → "Time zone for emails and dates". Two ways to set it, as in the zone sheet on
 * Bid: Automatic follows this device (and the zone it reported on the last visit is what emails
 * use), or Always use one city. A person on a fixed city who opens Account from a device in
 * another zone is offered the switch to Automatic. The picker is the shared zone dialog: a sheet
 * on phones, a dialog from 768px.
 */
export function TimeZoneSection({ initial, at, returnTo }: TimeZoneSectionProps) {
  const router = useRouter();
  const ready = useBrowserReady();
  const [preference, setPreference] = useState<TimeZonePreferenceVm | null>(
    initial ? toTimeZonePreferenceVm(initial) : null,
  );
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [switchFailed, setSwitchFailed] = useState(false);
  const reported = useRef<string | null>(null);
  const when = useMemo(() => new Date(at), [at]);
  const device = ready ? deviceTimeZone() : null;

  // Visiting while following the device keeps the stored zone current (emails use it).
  useEffect(() => {
    if (!preference || !shouldReportDeviceZone(preference, device)) return;
    if (reported.current === device) return;
    reported.current = device;
    void reportDeviceZoneAction(device).then((result) => {
      if (result.status === "ok") setPreference(toTimeZonePreferenceVm(result));
    });
  }, [preference, device]);

  const port = useMemo<ZonePreferencePort>(() => {
    function accept(result: TimeZoneActionResult): void {
      if (result.status === "reauth_required") {
        window.location.assign(buildReauthHref(returnTo));
        throw new Error("time_zone_sign_in_required");
      }
      if (result.status === "error") throw new Error("time_zone_not_saved");
      const next = toTimeZonePreferenceVm(result);
      setPreference(next);
      setSaved(
        next.zone
          ? `Saved. Your emails and dates now use ${cityName(next.zone)} time.`
          : "Saved. Your emails and dates will follow this device.",
      );
      router.refresh();
    }
    return {
      savedNote: SAVED_NOTE,
      save: async (zone) => accept(await saveTimeZoneAction({ mode: "fixed", zone })),
      followDevice: async () =>
        accept(await saveTimeZoneAction({ mode: "automatic", zone: deviceTimeZone() })),
    };
  }, [returnTo, router]);

  if (!preference) {
    return (
      <p role="alert" className="text-sm text-error">
        We couldn't load your time zone just now. Please refresh the page to try again.
      </p>
    );
  }

  const offer = deviceZoneOffer(preference, device);
  const current: SavedZone =
    preference.mode === "fixed"
      ? { zone: preference.zone, source: "account" }
      : { zone: preference.zone ?? device ?? "", source: "device" };

  async function switchToAutomatic() {
    setSwitching(true);
    setSwitchFailed(false);
    setSaved(null);
    try {
      await port.followDevice();
    } catch {
      setSwitchFailed(true);
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ListCard>
        <ListCardRow
          title={preference.mode === "automatic" ? "Automatic" : "Always use"}
          subtitle={automaticDetail(preference, ready)}
          value={preference.zone ? zoneLabel(preference.zone, when) : "Not detected yet"}
          trailing={
            <Button
              variant="outline"
              onClick={() => {
                setSaved(null);
                setOpen(true);
              }}
              aria-label="Change time zone for emails and dates"
            >
              Change
            </Button>
          }
        />
      </ListCard>
      {offer ? (
        <div className={`${CARD} ${CARD_PADDING} flex flex-col gap-3`}>
          <p className="text-sm text-on-surface">
            This device is in {zoneLabel(offer.deviceZone, when)}, but your emails and dates use{" "}
            {zoneLabel(offer.fixedZone, when)}. Switch to Automatic to follow this device?
          </p>
          <LoadingButton
            variant="outline"
            loading={switching}
            loadingLabel="Switching…"
            onClick={switchToAutomatic}
            className="self-start"
          >
            Switch to Automatic
          </LoadingButton>
          {switchFailed ? (
            <p role="alert" className="text-sm text-error">
              We couldn't save your time zone. Try again.
            </p>
          ) : null}
        </div>
      ) : null}
      {saved ? <output className="block text-sm text-success">{saved}</output> : null}
      <ZonePreferenceProvider port={port}>
        <ChangeZoneDialog
          open={open}
          onOpenChange={setOpen}
          current={current}
          at={when}
          description="Choose the time zone for your emails and for the times LAX Bid shows you."
        />
      </ZonePreferenceProvider>
    </div>
  );
}

/** The line under the title: what Automatic is based on, or that a city is fixed. */
function automaticDetail(preference: TimeZonePreferenceVm, ready: boolean): string {
  if (preference.mode === "fixed") return "Used in emails and dates until you change it.";
  if (!ready) return "Checking this device…";
  return preference.zone
    ? "Detected from your device on your last visit."
    : "We haven't detected this device's time zone yet.";
}
