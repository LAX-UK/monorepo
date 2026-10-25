"use client";

import { type CheckInMode, CheckInView } from "@/components/admin/event-rsvps/check-in-view";
import { useCallback, useState } from "react";
import { useBarcodeScanner } from "./use-barcode-scanner";
import { useGuestSearch } from "./use-guest-search";
import { useOnsiteCheckIn } from "./use-onsite-check-in";

type Props = {
  slug: string;
  title: string;
};

/** Wires the door check-in page to the scanner, the guest search and the check-in requests. */
export function OnsiteEventCheckInConsole({ slug, title }: Props) {
  const [mode, setMode] = useState<CheckInMode>("scan");
  const [manualToken, setManualToken] = useState("");

  const checkIn = useOnsiteCheckIn(slug);
  const guestSearch = useGuestSearch(slug);

  const handleScan = useCallback(
    (token: string) => {
      void checkIn.runCheckIn({ token });
    },
    [checkIn.runCheckIn],
  );

  const { cameraSupported, videoRef } = useBarcodeScanner({
    active: mode === "scan",
    busyRef: checkIn.busyRef,
    onScan: handleScan,
  });

  const handleManualCheckIn = useCallback(
    async (token: string) => {
      const next = await checkIn.runCheckIn({ token });
      if (next?.status === "VALID" || next?.status === "DRY_RUN_VALID") {
        setManualToken("");
      }
    },
    [checkIn.runCheckIn],
  );

  const handleRsvpCheckIn = useCallback(
    (rsvpId: string) => {
      void checkIn.runCheckIn({ rsvpId });
    },
    [checkIn.runCheckIn],
  );

  return (
    <CheckInView
      slug={slug}
      title={title}
      stats={checkIn.stats}
      statsError={checkIn.statsError}
      dryRunBusy={checkIn.dryRunBusy}
      dryRunError={checkIn.dryRunError}
      dryRunConfirmOpen={checkIn.dryRunConfirmOpen}
      onDryRunConfirmOpenChange={checkIn.setDryRunConfirmOpen}
      onEnableDryRun={checkIn.enableDryRun}
      onDisableDryRun={checkIn.disableDryRun}
      mode={mode}
      onModeChange={setMode}
      busy={checkIn.busy}
      networkError={checkIn.networkError}
      result={checkIn.result}
      scan={{
        videoRef,
        cameraSupported,
        manualToken,
        onManualTokenChange: setManualToken,
        onCheckIn: (token) => void handleManualCheckIn(token),
      }}
      search={{
        query: guestSearch.searchQuery,
        onQueryChange: guestSearch.setSearchQuery,
        results: guestSearch.searchResults,
        error: guestSearch.searchError,
        searching: guestSearch.searching,
        onCheckIn: handleRsvpCheckIn,
      }}
    />
  );
}
