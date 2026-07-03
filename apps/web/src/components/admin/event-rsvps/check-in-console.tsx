"use client";

import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@auction/ui/components/tabs";
import { useCallback, useState } from "react";
import { CheckInResultBanner } from "./check-in-result-banner";
import { CheckInScanTab } from "./check-in-scan-tab";
import { CheckInSearchTab } from "./check-in-search-tab";
import { CheckInStatsHeader } from "./check-in-stats-header";
import { useBarcodeScanner } from "./use-barcode-scanner";
import { useGuestSearch } from "./use-guest-search";
import { useOnsiteCheckIn } from "./use-onsite-check-in";

type Props = {
  slug: string;
  title: string;
};

export function OnsiteEventCheckInConsole({ slug, title }: Props) {
  const [activeTab, setActiveTab] = useState("scan");
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
    active: activeTab === "scan",
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
    <div className="space-y-6">
      <CheckInStatsHeader
        title={title}
        stats={checkIn.stats}
        statsError={checkIn.statsError}
        dryRunBusy={checkIn.dryRunBusy}
        dryRunError={checkIn.dryRunError}
        dryRunConfirmOpen={checkIn.dryRunConfirmOpen}
        onDryRunConfirmOpenChange={checkIn.setDryRunConfirmOpen}
        onEnableDryRun={checkIn.enableDryRun}
        onDisableDryRun={checkIn.disableDryRun}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="scan">Scan QR</TabsTrigger>
          <TabsTrigger value="search">Search name</TabsTrigger>
        </TabsList>

        <TabsContent value="scan">
          <CheckInScanTab
            videoRef={videoRef}
            cameraSupported={cameraSupported}
            manualToken={manualToken}
            onManualTokenChange={setManualToken}
            busy={checkIn.busy}
            onCheckIn={(token) => void handleManualCheckIn(token)}
          />
        </TabsContent>

        <TabsContent value="search">
          <CheckInSearchTab
            searchQuery={guestSearch.searchQuery}
            onSearchQueryChange={guestSearch.setSearchQuery}
            searchResults={guestSearch.searchResults}
            searchError={guestSearch.searchError}
            searching={guestSearch.searching}
            busy={checkIn.busy}
            onCheckIn={handleRsvpCheckIn}
          />
        </TabsContent>
      </Tabs>

      {checkIn.busy ? (
        <p className="font-body text-sm text-on-surface-variant" aria-live="polite">
          Checking in…
        </p>
      ) : null}

      {checkIn.networkError ? (
        <AdminListAlert title="Could not reach the server">
          {checkIn.networkError}
          <span className="mt-2 block">
            Try again or use Search name to admit the guest manually.
          </span>
        </AdminListAlert>
      ) : null}

      {checkIn.result ? <CheckInResultBanner result={checkIn.result} /> : null}
    </div>
  );
}
