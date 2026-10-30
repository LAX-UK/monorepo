"use client";

import {
  QR_ANALYTICS_PRESET_OPTIONS,
  useQrAnalytics,
} from "@/components/admin/qr-code/use-qr-analytics";
import { ChartRenderer } from "@/components/charts/chart-renderer";
import { formatDateTime } from "@/lib/ui/format";
import {
  DateRangeFilter,
  EmptyState,
  Notice,
  SegmentedControl,
  Skeleton,
  StaffButton,
  StatGrid,
} from "@auction/staff-ui";
import { AUCTION_ZONE_LABEL } from "@auction/ui/lib/datetime";
import type {
  QrCodeAnalyticsBreakdownRow,
  QrCodeAnalyticsRange,
  QrCodeDetailedAnalytics,
  QrCodeRecentScan,
} from "@auction/validators";

type Props = {
  qrCodeId: string;
  initialAnalytics: QrCodeDetailedAnalytics | null;
};

/** Scans of one QR code over a range: totals, a trend, and where scans came from. */
export function QrAnalyticsPanel({ qrCodeId, initialAnalytics }: Props) {
  const {
    selection,
    analytics,
    loading,
    error,
    rangeLabel,
    retry,
    selectPreset,
    selectCustom,
    updateCustomRange,
  } = useQrAnalytics(qrCodeId, initialAnalytics);

  return (
    <section
      aria-label="Scan analytics"
      className="flex flex-col gap-4 rounded-staff-lg border border-staff-line bg-staff-sunken p-3 text-staff-sm"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-medium text-staff-fg">Scan analytics</h3>
          <p className="text-staff-xs text-staff-muted">{rangeLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <SegmentedControl
              label="QR analytics range"
              value={selection.kind === "preset" ? selection.value : "custom"}
              options={[
                ...QR_ANALYTICS_PRESET_OPTIONS.map((option) => ({
                  value: option.value as string,
                  label: option.label,
                })),
                { value: "custom", label: "Custom" },
              ]}
              onValueChange={(next) => {
                if (next === "custom") {
                  selectCustom();
                  return;
                }
                selectPreset(next as QrCodeAnalyticsRange);
              }}
            />
          </div>
          {selection.kind === "custom" ? (
            <div className="flex items-center gap-2">
              <DateRangeFilter label="Dates" value={selection.value} onChange={updateCustomRange} />
              <p className="text-staff-xs text-staff-muted">{AUCTION_ZONE_LABEL}</p>
            </div>
          ) : null}
        </div>
      </div>

      {loading && !analytics ? <QrAnalyticsSkeleton /> : null}
      {!loading && error ? (
        <Notice
          tone="danger"
          alert
          title="Could not load analytics"
          actions={
            <StaffButton size="sm" variant="secondary" onClick={retry}>
              Try again
            </StaffButton>
          }
        >
          {error}
        </Notice>
      ) : null}
      {analytics && !error ? (
        <div className={loading ? "pointer-events-none opacity-60" : undefined}>
          <QrAnalyticsContent analytics={analytics} loading={loading} />
        </div>
      ) : null}
    </section>
  );
}

function QrAnalyticsContent({
  analytics,
  loading,
}: {
  analytics: QrCodeDetailedAnalytics;
  loading: boolean;
}) {
  const trendData = analytics.trend.map((row) => ({
    label: formatTrendLabel(row.bucket, analytics.granularity),
    value: row.scans,
  }));

  return (
    <div className="flex flex-col gap-4">
      {loading ? (
        <p className="text-staff-xs text-staff-muted" aria-live="polite">
          Updating analytics…
        </p>
      ) : null}
      <StatGrid
        label="Scan totals"
        className="grid-cols-2 md:grid-cols-3"
        items={[
          { id: "scans", label: "Scans", value: String(analytics.totalScans) },
          ...(analytics.uniqueIps != null
            ? [{ id: "ips", label: "Unique IPs", value: String(analytics.uniqueIps) }]
            : []),
          {
            id: "device",
            label: "Top device",
            value: formatStatValue(analytics.byDevice[0]?.key ?? "None yet"),
          },
          {
            id: "country",
            label: "Top country",
            value: formatStatValue(analytics.byCountry[0]?.key ?? "None yet"),
          },
        ]}
      />

      {analytics.totalScans === 0 ? (
        <EmptyState
          size="compact"
          headingLevel="h3"
          illustration="search"
          title="No scans yet"
          description="Printed labels will appear here after scanning."
        />
      ) : (
        <>
          <QrTrendChart data={trendData} granularity={analytics.granularity} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <QrBreakdownList
              title="By device"
              rows={analytics.byDevice}
              total={analytics.totalScans}
            />
            <QrBreakdownList
              title="By country"
              rows={analytics.byCountry}
              total={analytics.totalScans}
            />
            {analytics.source === "raw" ? (
              <>
                <QrBreakdownList
                  title="By browser"
                  rows={analytics.byBrowser ?? []}
                  total={analytics.totalScans}
                />
                <QrBreakdownList
                  title="By OS"
                  rows={analytics.byOs ?? []}
                  total={analytics.totalScans}
                />
                <QrBreakdownList
                  title="By referrer"
                  rows={analytics.byReferrer ?? []}
                  total={analytics.totalScans}
                />
              </>
            ) : (
              <p className="text-staff-xs text-staff-muted sm:col-span-2">
                Browser, OS, referrer, and recent scan details are available in the 24h view.
              </p>
            )}
          </div>
          {analytics.source === "raw" && analytics.recentScans?.length ? (
            <QrRecentScans rows={analytics.recentScans} />
          ) : null}
        </>
      )}
    </div>
  );
}

function QrTrendChart({
  data,
  granularity,
}: {
  data: { label: string; value: number }[];
  granularity: "hour" | "day";
}) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-staff-xs font-medium text-staff-muted">
        {granularity === "hour" ? "Hourly scans" : "Daily scans"}
      </h4>
      <div className="overflow-x-auto">
        <div className={data.length > 12 ? "min-w-[480px]" : undefined}>
          <ChartRenderer kind="bar" data={data} height={140} />
        </div>
      </div>
    </div>
  );
}

function QrBreakdownList({
  title,
  rows,
  total,
}: {
  title: string;
  rows: QrCodeAnalyticsBreakdownRow[];
  total: number;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-staff-lg border border-staff-line bg-staff-surface p-3">
      <h4 className="text-staff-xs font-medium text-staff-muted">{title}</h4>
      <ul className="flex flex-col gap-2">
        {rows.map((row) => {
          const pct = total > 0 ? Math.round((row.scans / total) * 100) : 0;
          return (
            <li key={`${title}-${row.key}`} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2 text-staff-xs">
                <span className="truncate text-staff-fg">{formatStatValue(row.key)}</span>
                <span className="shrink-0 tabular-nums text-staff-muted">
                  {row.scans} ({pct}%)
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-staff-sunken">
                <div
                  className="h-full rounded-full bg-staff-ink"
                  style={{ width: `${Math.max(pct, row.scans > 0 ? 4 : 0)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function QrRecentScans({ rows }: { rows: QrCodeRecentScan[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-staff-xs font-medium text-staff-muted">Recent scans</h4>
      <ul className="max-h-48 divide-y divide-staff-line-subtle overflow-y-auto overscroll-contain rounded-staff-lg border border-staff-line bg-staff-surface">
        {rows.map((row, index) => (
          <li key={`${row.scannedAt}-${index}`} className="px-3 py-2 text-staff-xs">
            <p className="font-medium text-staff-fg">{formatDateTime(row.scannedAt)}</p>
            <p className="text-staff-muted">
              {formatStatValue(row.deviceType)} · {formatStatValue(row.browser)} ·{" "}
              {formatStatValue(row.os)} · {formatStatValue(row.country)}
              {row.referrerHost ? ` · ${row.referrerHost}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function QrAnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading analytics">
      <Skeleton className="h-16 w-full rounded-staff-lg" />
      <Skeleton className="h-36 w-full rounded-staff-lg" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Skeleton className="h-28 rounded-staff-lg" />
        <Skeleton className="h-28 rounded-staff-lg" />
      </div>
    </div>
  );
}

function formatTrendLabel(bucket: string, granularity: "hour" | "day"): string {
  if (granularity === "day") return bucket.slice(5);
  const date = new Date(bucket);
  if (Number.isNaN(date.getTime())) return bucket;
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatStatValue(value: string): string {
  if (value === "unknown") return "Unknown";
  if (value === "direct") return "Direct";
  return value;
}
