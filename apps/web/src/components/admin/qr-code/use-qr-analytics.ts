"use client";

import { adminLoadQrCodeAnalyticsResultAction } from "@/lib/actions/admin-qr-codes";
import { customDateRangeToAnalyticsQuery } from "@/lib/admin/qr-analytics-range";
import type { DateRangeValue } from "@auction/ui/components/date-range-picker";
import { DEFAULT_AUCTION_ZONE, toDateFormString } from "@auction/ui/lib/datetime";
import type { QrCodeAnalyticsRange, QrCodeDetailedAnalytics } from "@auction/validators";
import { TZDate } from "@date-fns/tz";
import { addDays } from "date-fns";
import { useCallback, useEffect, useRef, useState } from "react";

export type QrAnalyticsRangeSelection =
  | { kind: "preset"; value: QrCodeAnalyticsRange }
  | { kind: "custom"; value: DateRangeValue };

export const QR_ANALYTICS_PRESET_OPTIONS: { value: QrCodeAnalyticsRange; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "all", label: "All" },
];

function rangeCacheKey(selection: QrAnalyticsRangeSelection): string {
  if (selection.kind === "preset") return selection.value;
  return `custom:${selection.value.from}:${selection.value.to}`;
}

function toAnalyticsQuery(selection: QrAnalyticsRangeSelection) {
  if (selection.kind === "preset") return { range: selection.value };
  return customDateRangeToAnalyticsQuery(selection.value);
}

export function defaultQrAnalyticsCustomRange(): DateRangeValue {
  const end = new TZDate(new Date(), DEFAULT_AUCTION_ZONE);
  const start = addDays(new TZDate(new Date(end.getTime()), DEFAULT_AUCTION_ZONE), -29);
  return {
    from: toDateFormString(new Date(start.getTime()), DEFAULT_AUCTION_ZONE),
    to: toDateFormString(new Date(end.getTime()), DEFAULT_AUCTION_ZONE),
  };
}

export function useQrAnalytics(qrCodeId: string, initialAnalytics: QrCodeDetailedAnalytics | null) {
  const [selection, setSelection] = useState<QrAnalyticsRangeSelection>({
    kind: "preset",
    value: "30d",
  });
  const [analytics, setAnalytics] = useState<QrCodeDetailedAnalytics | null>(initialAnalytics);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef(new Map<string, QrCodeDetailedAnalytics>());
  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (initialAnalytics) {
      cacheRef.current.set("30d", initialAnalytics);
    }
  }, [initialAnalytics]);

  const fetchAnalytics = useCallback(
    async (nextSelection: QrAnalyticsRangeSelection) => {
      const key = rangeCacheKey(nextSelection);
      const cached = cacheRef.current.get(key);
      if (cached) {
        setAnalytics(cached);
        setError(null);
        setLoading(false);
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
      ? (QR_ANALYTICS_PRESET_OPTIONS.find((option) => option.value === selection.value)?.label ??
        selection.value)
      : "Custom";

  const retry = useCallback(() => {
    cacheRef.current.delete(rangeCacheKey(selection));
    void fetchAnalytics(selection);
  }, [fetchAnalytics, selection]);

  const selectPreset = useCallback((value: QrCodeAnalyticsRange) => {
    setSelection({ kind: "preset", value });
  }, []);

  const selectCustom = useCallback(() => {
    setSelection((current) => {
      if (current.kind === "custom") return current;
      return { kind: "custom", value: defaultQrAnalyticsCustomRange() };
    });
  }, []);

  const updateCustomRange = useCallback((value: DateRangeValue) => {
    setSelection({ kind: "custom", value });
  }, []);

  return {
    selection,
    analytics,
    loading,
    error,
    rangeLabel,
    retry,
    selectPreset,
    selectCustom,
    updateCustomRange,
  };
}
