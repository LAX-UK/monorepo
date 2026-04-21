"use client";

import { cn } from "@auction/ui";
import { DateRangePicker, type DateRangeValue } from "@auction/ui/components/date-range-picker";
import { Toolbar } from "@auction/ui/components/toolbar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function clampDays(n: number): number {
  if (!Number.isFinite(n)) return 30;
  return Math.min(365, Math.max(1, Math.floor(n)));
}

function rangeForLastDays(days: number): DateRangeValue {
  const end = new Date();
  const start = new Date();
  start.setUTCDate(end.getUTCDate() - (clampDays(days) - 1));
  return { from: toYmd(start), to: toYmd(end) };
}

function daysInclusive(range: DateRangeValue): number {
  const a = Date.parse(`${range.from}T00:00:00.000Z`);
  const b = Date.parse(`${range.to}T00:00:00.000Z`);
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
    <Toolbar
      className="mb-8"
      filters={
        <div className="flex w-full min-w-0 flex-col gap-4">
          <fieldset className="flex min-w-0 flex-wrap gap-2 border-0 p-0">
            <legend className="sr-only">Quick range</legend>
            {[7, 30, 90].map((d) => (
              <Link
                key={d}
                href={href(d)}
                className={cn(
                  "rounded-full border px-3 py-1.5 font-label text-xs uppercase tracking-widest transition-colors",
                  safeDays === d
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-outline-variant/30 text-on-surface-variant hover:border-primary/40",
                )}
              >
                Last {d} days
              </Link>
            ))}
          </fieldset>
          <DateRangePicker
            key={safeDays}
            value={value}
            onChange={(next) => {
              navigateToDays(daysInclusive(next));
            }}
          />
        </div>
      }
    />
  );
}
