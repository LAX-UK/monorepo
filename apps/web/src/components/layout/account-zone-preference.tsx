"use client";

import {
  reportDeviceZone,
  saveAccountAutomaticZone,
  saveAccountFixedZone,
} from "@/lib/data/http/account-time-zone.client";
import { deviceTimeZone } from "@auction/datetime";
import {
  type ZonePreferencePort,
  ZonePreferenceProvider,
  deviceZonePreference,
  setAccountViewerZone,
} from "@auction/ui/time";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo } from "react";

type AccountTimeZone = { mode: "automatic" | "fixed"; zone: string | null };

const SAVED_NOTE = "Saved to your LAX Account, so your emails use it too.";

/**
 * Where the time zone sheet saves, by who is looking. Signed out, the choice stays on this device
 * (the `lax_tz` cookie, the shared default). Signed in, it is saved to LAX Account, which also
 * uses it for emails, and the page is refreshed so the server draws the new zone. While the
 * person follows their device, each visit tells LAX Account which zone the device is in.
 */
export function AccountZonePreference({
  timeZone,
  children,
}: {
  /** The signed-in person's LAX Account choice; null when signed out. */
  timeZone: AccountTimeZone | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const signedIn = timeZone !== null;
  const mode = timeZone?.mode;
  const storedZone = timeZone?.zone ?? null;

  useEffect(() => {
    if (mode !== "automatic") return;
    const zone = deviceTimeZone();
    if (zone && zone !== storedZone) void reportDeviceZone(zone);
  }, [mode, storedZone]);

  const port = useMemo<ZonePreferencePort>(() => {
    if (!signedIn) return deviceZonePreference;
    return {
      savedNote: SAVED_NOTE,
      async save(zone) {
        if (!(await saveAccountFixedZone(zone))) throw new Error("time_zone_not_saved");
        // The server's copy only catches up once the worker has projected the change, so the
        // refresh alone could draw the old zone: show the saved one now.
        setAccountViewerZone({ mode: "fixed", zone });
        router.refresh();
      },
      async followDevice() {
        if (!(await saveAccountAutomaticZone(deviceTimeZone()))) {
          throw new Error("time_zone_not_saved");
        }
        // The chip reads the device straight away; the refresh brings the server's view along.
        await deviceZonePreference.followDevice();
        setAccountViewerZone({ mode: "automatic", zone: deviceTimeZone() });
        router.refresh();
      },
    };
  }, [signedIn, router]);

  return <ZonePreferenceProvider port={port}>{children}</ZonePreferenceProvider>;
}
