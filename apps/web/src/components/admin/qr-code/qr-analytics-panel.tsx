"use client";

import {
  QR_ANALYTICS_PRESET_OPTIONS,
  useQrAnalytics,
} from "@/components/admin/qr-code/use-qr-analytics";
import { ChartRenderer } from "@/components/charts/chart-renderer";
import { formatDateTime } from "@/lib/ui/format";
import { SegmentToggle } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { DateRangePicker } from "@auction/ui/components/date-range-picker";
import { Skeleton } from "@auction/ui/components/skeleton";
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
    <div className="space-y-4 rounded-lg bg-surface-container-high p-3 text-sm">
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium text-on-surface">Scan analytics</p>
          <p className="text-xs text-on-surface-variant">{rangeLabel}</p>
        </div>
        <div className="flex flex-col gap-2">
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <SegmentToggle
              aria-label="QR analytics range"
              value={selection.kind === "preset" ? selection.value : "custom"}
              options={[
                ...QR_ANALYTICS_PRESET_OPTIONS.map((option) => ({
                  value: option.value,
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
            <div className="flex flex-col gap-1">
              <DateRangePicker value={selection.value} onChange={updateCustomRange} />
              <p className="font-body text-xs text-on-surface-variant">{AUCTION_ZONE_LABEL}</p>
            </div>
          ) : null}
        </div>
      </div>

      {loading && !analytics ? <QrAnalyticsSkeleton /> : null}
      {!loading && error ? (
        <div className="rounded-md border border-error/30 bg-error-container/20 p-3 text-sm">
          <p className="text-on-surface-variant">{error}</p>
          <Button
            type="button"
            variant="link"
            size="link"
            className="mt-2 h-auto p-0"
            onClick={retry}
          >
            Try again
          </Button>
        </div>
      ) : null}
      {analytics && !error ? (
        <div className={loading ? "pointer-events-none opacity-60" : undefined}>
          <QrAnalyticsContent analytics={analytics} loading={loading} />
        </div>
      ) : null}
    </div>
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
    <div className="space-y-4">
      {loading ? (
        <p className="text-xs text-on-surface-variant" aria-live="polite">
          Updating analytics…
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <QrStatCard label="Scans" value={String(analytics.totalScans)} />
        {analytics.uniqueIps != null ? (
          <QrStatCard label="Unique IPs" value={String(analytics.uniqueIps)} />
        ) : null}
        <QrStatCard
          label="Top device"
          value={formatStatValue(analytics.byDevice[0]?.key ?? "None yet")}
        />
        <QrStatCard
          label="Top country"
          value={formatStatValue(analytics.byCountry[0]?.key ?? "None yet")}
        />
      </div>

      {analytics.totalScans === 0 ? (
        <p className="text-on-surface-variant">
          No scans yet. Printed labels will appear here after scanning.
        </p>
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
              <p className="text-xs text-on-surface-variant sm:col-span-2">
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
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">
        {granularity === "hour" ? "Hourly scans" : "Daily scans"}
      </p>
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
    <div className="space-y-2 rounded-md border border-border-hairline bg-surface-container-lowest p-2">
      <p className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">{title}</p>
      <ul className="space-y-1.5">
        {rows.map((row) => {
          const pct = total > 0 ? Math.round((row.scans / total) * 100) : 0;
          return (
            <li key={`${title}-${row.key}`} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-on-surface">{formatStatValue(row.key)}</span>
                <span className="shrink-0 text-on-surface-variant">
                  {row.scans} ({pct}%)
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-high">
                <div
                  className="h-full rounded-full bg-primary"
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
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">
        Recent scans
      </p>
      <ul className="max-h-48 divide-y divide-border-hairline overflow-y-auto rounded-md border border-border-hairline bg-surface-container-lowest overscroll-contain">
        {rows.map((row, index) => (
          <li key={`${row.scannedAt}-${index}`} className="space-y-0.5 px-2 py-2 text-xs">
            <p className="font-medium text-on-surface">{formatDateTime(row.scannedAt)}</p>
            <p className="text-on-surface-variant">
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

function QrStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border-hairline bg-surface-container-lowest p-2">
      <p className="text-[11px] uppercase tracking-wide text-on-surface-variant">{label}</p>
      <p className="mt-1 truncate font-medium text-on-surface">{value}</p>
    </div>
  );
}

function QrAnalyticsSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Skeleton className="h-16 rounded-md" />
        <Skeleton className="h-16 rounded-md" />
        <Skeleton className="h-16 rounded-md" />
      </div>
      <Skeleton className="h-36 rounded-md" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Skeleton className="h-28 rounded-md" />
        <Skeleton className="h-28 rounded-md" />
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
