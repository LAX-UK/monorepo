"use client";

import { ChartRenderer } from "@/components/charts/chart-renderer";
import {
  type AdminQrCodeAnalytics,
  type AdminQrCodeBreakdownRow,
  type AdminQrCodeRecentScan,
  adminLoadQrCodeAnalyticsResultAction,
} from "@/lib/actions/admin-qr-codes";
import { customDateRangeToAnalyticsQuery } from "@/lib/admin/qr-analytics-range";
import { formatDateTime } from "@/lib/ui/format";
import { SegmentToggle } from "@auction/ui";
import { DateRangePicker, type DateRangeValue } from "@auction/ui/components/date-range-picker";
import { Skeleton } from "@auction/ui/components/skeleton";
import {
  AUCTION_ZONE_LABEL,
  DEFAULT_AUCTION_ZONE,
  toDateFormString,
} from "@auction/ui/lib/datetime";
import type { QrCodeAnalyticsRange } from "@auction/validators";
import { TZDate } from "@date-fns/tz";
import { addDays } from "date-fns";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  qrCodeId: string;
  initialAnalytics: AdminQrCodeAnalytics | null;
};

type RangeSelection =
  | { kind: "preset"; value: QrCodeAnalyticsRange }
  | { kind: "custom"; value: DateRangeValue };

const PRESET_OPTIONS: { value: QrCodeAnalyticsRange; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "all", label: "All" },
];

function rangeCacheKey(selection: RangeSelection): string {
  if (selection.kind === "preset") return selection.value;
  return `custom:${selection.value.from}:${selection.value.to}`;
}

function toAnalyticsQuery(selection: RangeSelection) {
  if (selection.kind === "preset") return { range: selection.value };
  return customDateRangeToAnalyticsQuery(selection.value);
}

function defaultCustomRange(): DateRangeValue {
  const end = new TZDate(new Date(), DEFAULT_AUCTION_ZONE);
  const start = addDays(new TZDate(new Date(end.getTime()), DEFAULT_AUCTION_ZONE), -29);
  return {
    from: toDateFormString(new Date(start.getTime()), DEFAULT_AUCTION_ZONE),
    to: toDateFormString(new Date(end.getTime()), DEFAULT_AUCTION_ZONE),
  };
}

export function QrAnalyticsPanel({ qrCodeId, initialAnalytics }: Props) {
  const [selection, setSelection] = useState<RangeSelection>({ kind: "preset", value: "30d" });
  const [analytics, setAnalytics] = useState<AdminQrCodeAnalytics | null>(initialAnalytics);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef(new Map<string, AdminQrCodeAnalytics>());
  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (initialAnalytics) {
      cacheRef.current.set("30d", initialAnalytics);
    }
  }, [initialAnalytics]);

  const fetchAnalytics = useCallback(
    async (nextSelection: RangeSelection) => {
      const key = rangeCacheKey(nextSelection);
      const cached = cacheRef.current.get(key);
      if (cached) {
        setAnalytics(cached);
        setError(null);
        return;
      }

      const seq = ++requestSeqRef.current;
      setLoading(true);
      setError(null);
      try {
        const result = await adminLoadQrCodeAnalyticsResultAction(
          qrCodeId,
          toAnalyticsQuery(nextSelection),
        );
        if (seq !== requestSeqRef.current) return;
        if (!result.ok) {
          setError(result.error);
          return;
        }
        if (result.data) {
          cacheRef.current.set(key, result.data);
          setAnalytics(result.data);
        }
      } catch (err) {
        if (seq !== requestSeqRef.current) return;
        setError(err instanceof Error ? err.message : "Could not load analytics");
      } finally {
        if (seq === requestSeqRef.current) setLoading(false);
      }
    },
    [qrCodeId],
  );

  useEffect(() => {
    if (selection.kind === "preset" && selection.value === "30d" && initialAnalytics) {
      setAnalytics(initialAnalytics);
      return;
    }
    void fetchAnalytics(selection);
  }, [fetchAnalytics, initialAnalytics, selection]);

  const rangeLabel =
    selection.kind === "preset"
      ? (PRESET_OPTIONS.find((option) => option.value === selection.value)?.label ??
        selection.value)
      : "Custom";

  return (
    <div className="space-y-4 rounded-lg bg-surface-container-high p-3 text-sm">
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium text-on-surface">Scan analytics</p>
          <p className="text-xs text-on-surface-variant">{rangeLabel}</p>
        </div>
        <div className="flex flex-col gap-2">
          <SegmentToggle
            aria-label="QR analytics range"
            value={selection.kind === "preset" ? selection.value : "custom"}
            options={[
              ...PRESET_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              })),
              { value: "custom", label: "Custom" },
            ]}
            onValueChange={(next) => {
              if (next === "custom") {
                setSelection({ kind: "custom", value: defaultCustomRange() });
                return;
              }
              setSelection({ kind: "preset", value: next as QrCodeAnalyticsRange });
            }}
          />
          {selection.kind === "custom" ? (
            <div className="flex flex-col gap-1">
              <DateRangePicker
                value={selection.value}
                onChange={(next) => setSelection({ kind: "custom", value: next })}
              />
              <p className="font-body text-xs text-on-surface-variant">{AUCTION_ZONE_LABEL}</p>
            </div>
          ) : null}
        </div>
      </div>

      {loading ? <QrAnalyticsSkeleton /> : null}
      {!loading && error ? <p className="text-on-surface-variant">{error}</p> : null}
      {!loading && !error && analytics ? <QrAnalyticsContent analytics={analytics} /> : null}
    </div>
  );
}

function QrAnalyticsContent({ analytics }: { analytics: AdminQrCodeAnalytics }) {
  const trendData = analytics.trend.map((row) => ({
    label: formatTrendLabel(row.bucket, analytics.granularity),
    value: row.scans,
  }));

  return (
    <div className="space-y-4">
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
      <ChartRenderer kind="bar" data={data} height={140} />
    </div>
  );
}

function QrBreakdownList({
  title,
  rows,
  total,
}: {
  title: string;
  rows: AdminQrCodeBreakdownRow[];
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

function QrRecentScans({ rows }: { rows: AdminQrCodeRecentScan[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">
        Recent scans
      </p>
      <ul className="divide-y divide-border-hairline rounded-md border border-border-hairline bg-surface-container-lowest">
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
