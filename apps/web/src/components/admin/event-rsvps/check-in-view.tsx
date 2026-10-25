"use client";

import { CheckInResultBanner } from "@/components/admin/event-rsvps/check-in-result-banner";
import { CheckInScanTab } from "@/components/admin/event-rsvps/check-in-scan-tab";
import { CheckInSearchTab } from "@/components/admin/event-rsvps/check-in-search-tab";
import { StaffBreadcrumbs } from "@/components/admin/staff/staff-breadcrumbs";
import {
  ConfirmActionDialog,
  DetailPage,
  MetaItem,
  type Metric,
  MetricStrip,
  Notice,
  SegmentedControl,
  StaffButton,
  StatusBadge,
} from "@auction/staff-ui";
import type { OnsiteEventCheckInResult, OnsiteEventCheckInSearchRow } from "@auction/types";
import { ScanLine } from "lucide-react";
import type { RefObject } from "react";

export type CheckInStats = {
  total: number;
  checkedIn: number;
  checkInDryRun: boolean;
};

export type CheckInMode = "scan" | "search";

type Props = {
  slug: string;
  title: string;
  stats: CheckInStats;
  statsError: string | null;
  dryRunBusy: boolean;
  dryRunError: string | null;
  dryRunConfirmOpen: boolean;
  onDryRunConfirmOpenChange: (open: boolean) => void;
  onEnableDryRun: () => void;
  onDisableDryRun: () => void;
  mode: CheckInMode;
  onModeChange: (mode: CheckInMode) => void;
  /** True while a check-in request is running. */
  busy: boolean;
  networkError: string | null;
  result: OnsiteEventCheckInResult | null;
  scan: {
    videoRef: RefObject<HTMLVideoElement | null>;
    cameraSupported: boolean | null;
    manualToken: string;
    onManualTokenChange: (value: string) => void;
    onCheckIn: (token: string) => void;
  };
  search: {
    query: string;
    onQueryChange: (value: string) => void;
    results: readonly OnsiteEventCheckInSearchRow[];
    error: string | null;
    searching: boolean;
    onCheckIn: (rsvpId: string) => void;
  };
};

const MODES = [
  { value: "scan", label: "Scan QR" },
  { value: "search", label: "Search name" },
] as const;

/**
 * The door check-in page: how many guests have arrived, the outcome of the last check-in, and the
 * two ways to admit someone, scanning a pass or searching by name. Dry run checks passes without
 * recording arrivals, so it is switched on to rehearse and off when the door opens.
 */
export function CheckInView({
  slug,
  title,
  stats,
  statsError,
  dryRunBusy,
  dryRunError,
  dryRunConfirmOpen,
  onDryRunConfirmOpenChange,
  onEnableDryRun,
  onDisableDryRun,
  mode,
  onModeChange,
  busy,
  networkError,
  result,
  scan,
  search,
}: Props) {
  const eventHref = `/admin/event-rsvps/${encodeURIComponent(slug)}`;
  const metrics: Metric[] = [
    { id: "arrived", label: "Arrived", value: stats.checkedIn },
    { id: "expected", label: "RSVPs", value: stats.total },
    { id: "waiting", label: "Still to arrive", value: Math.max(stats.total - stats.checkedIn, 0) },
  ];

  return (
    <>
      <DetailPage
        breadcrumbs={
          <StaffBreadcrumbs
            items={[
              { label: "Event RSVPs", href: "/admin/event-rsvps" },
              { label: title, href: eventHref },
              { label: "Check-in" },
            ]}
          />
        }
        title={`${title} check-in`}
        status={
          stats.checkInDryRun ? (
            <StatusBadge tone="warning">Dry run</StatusBadge>
          ) : (
            <StatusBadge tone="success">Live</StatusBadge>
          )
        }
        meta={
          <MetaItem label="Arrived">
            {stats.checkedIn} of {stats.total}
          </MetaItem>
        }
        secondaryActions={
          stats.checkInDryRun ? (
            <StaffButton
              variant="primary"
              loading={dryRunBusy}
              icon={<ScanLine aria-hidden />}
              onClick={() => onDryRunConfirmOpenChange(true)}
            >
              Go live
            </StaffButton>
          ) : (
            <StaffButton variant="secondary" loading={dryRunBusy} onClick={onEnableDryRun}>
              Turn on dry run
            </StaffButton>
          )
        }
        notice={
          <>
            {stats.checkInDryRun ? (
              <Notice tone="warning" title="Dry run is on">
                Scans are checked but not recorded. Go live before admitting guests for real.
              </Notice>
            ) : null}
            {statsError ? (
              <Notice tone="warning" title="The arrival counts did not refresh">
                {statsError}
              </Notice>
            ) : null}
            {dryRunError ? (
              <Notice tone="danger" alert title="Dry run was not changed">
                {dryRunError}
              </Notice>
            ) : null}
          </>
        }
      >
        <MetricStrip
          label="Arrivals"
          items={metrics}
          period="Live count, refreshed every 45 seconds"
        />
        {networkError ? (
          <Notice tone="danger" alert title="Could not reach the server">
            {networkError} Try again, or search for the guest by name to admit them manually.
          </Notice>
        ) : null}
        {busy ? <output className="text-staff-sm text-staff-muted">Checking in…</output> : null}
        {result ? <CheckInResultBanner result={result} /> : null}
        <SegmentedControl
          label="Check-in method"
          size="md"
          value={mode}
          onValueChange={onModeChange}
          options={MODES}
        />
        {mode === "scan" ? (
          <CheckInScanTab
            videoRef={scan.videoRef}
            cameraSupported={scan.cameraSupported}
            manualToken={scan.manualToken}
            onManualTokenChange={scan.onManualTokenChange}
            busy={busy}
            onCheckIn={scan.onCheckIn}
          />
        ) : (
          <CheckInSearchTab
            searchQuery={search.query}
            onSearchQueryChange={search.onQueryChange}
            searchResults={search.results}
            searchError={search.error}
            searching={search.searching}
            busy={busy}
            onCheckIn={search.onCheckIn}
          />
        )}
      </DetailPage>
      <ConfirmActionDialog
        open={dryRunConfirmOpen}
        onOpenChange={onDryRunConfirmOpenChange}
        title="Go live with check-in?"
        description="Turning off dry run records real arrivals. Only continue when you are ready to admit guests at the door."
        confirmLabel="Go live"
        cancelLabel="Stay in dry run"
        tone="danger"
        loading={dryRunBusy}
        onConfirm={onDisableDryRun}
      />
    </>
  );
}
