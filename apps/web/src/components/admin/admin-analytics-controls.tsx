"use client";

import { SegmentToggle } from "@auction/ui";
import { DateRangePicker, type DateRangeValue } from "@auction/ui/components/date-range-picker";
import {
  AUCTION_ZONE_LABEL,
  DEFAULT_AUCTION_ZONE,
  toDateFormString,
} from "@auction/ui/lib/datetime";
import { TZDate } from "@date-fns/tz";
import { addDays } from "date-fns";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

function toYmd(d: Date): string {
  return toDateFormString(d, DEFAULT_AUCTION_ZONE);
}

function clampDays(n: number): number {
  if (!Number.isFinite(n)) return 30;
  return Math.min(365, Math.max(1, Math.floor(n)));
}

function rangeForLastDays(days: number): DateRangeValue {
  const end = new TZDate(new Date(), DEFAULT_AUCTION_ZONE);
  const start = addDays(
    new TZDate(new Date(end.getTime()), DEFAULT_AUCTION_ZONE),
    -(clampDays(days) - 1),
  );
  return { from: toYmd(new Date(start.getTime())), to: toYmd(new Date(end.getTime())) };
}

function daysInclusive(range: DateRangeValue): number {
  const a = Date.parse(`${range.from}T12:00:00`);
  const b = Date.parse(`${range.to}T12:00:00`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 30;
  if (b < a) return 1;
  return clampDays(Math.round((b - a) / 86400000) + 1);
}

type Props = {
  days: number;
};

export function AdminAnalyticsControls({ days }: Props) {
  const router = useRouter();
  const safeDays = clampDays(days);
  const href = useCallback((d: number) => `/admin/analytics?days=${clampDays(d)}`, []);
  const navigateToDays = useCallback(
    (next: number) => {
      router.replace(href(next));
    },
    [href, router],
  );

  const value = useMemo(() => rangeForLastDays(safeDays), [safeDays]);

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
      <SegmentToggle
        aria-label="Quick analytics range"
        value={String(safeDays)}
        options={[
          { value: "7", label: "7d" },
          { value: "30", label: "30d" },
          { value: "90", label: "90d" },
        ]}
        onValueChange={(next: string) => navigateToDays(Number(next))}
      />
      <div className="flex flex-col gap-1">
        <DateRangePicker
          key={safeDays}
          value={value}
          onChange={(next) => {
            navigateToDays(daysInclusive(next));
          }}
        />
        <p className="font-body text-xs text-on-surface-variant">{AUCTION_ZONE_LABEL}</p>
      </div>
    </div>
  );
}
