"use client";

import type { CalendarSalesUrlState } from "@/lib/marketing/sales-calendar-params";
import { calendarSalesHrefFromState } from "@/lib/marketing/sales-calendar-params";
import { Button } from "@auction/ui";
import Link from "next/link";
import { useMemo, useState } from "react";

const DEFAULT_MIN = 0;
const DEFAULT_MAX = 50_000;

type Props = {
  state: CalendarSalesUrlState;
  /** Optional labels; defaults match mock. */
  min?: number;
  max?: number;
};

export function SalesPriceSlider({ state, min = DEFAULT_MIN, max = DEFAULT_MAX }: Props) {
  const initialMin = state.minPrice ?? min;
  const initialMax = state.maxPrice ?? max;
  const [lo, setLo] = useState(() => Math.min(initialMin, initialMax));
  const [hi, setHi] = useState(() => Math.max(initialMin, initialMax));

  const applyHref = useMemo(
    () => calendarSalesHrefFromState(state, { minPrice: lo, maxPrice: hi }),
    [state, lo, hi],
  );

  const clearHref = useMemo(
    () => calendarSalesHrefFromState(state, { minPrice: undefined, maxPrice: undefined }),
    [state],
  );

  return (
    <div className="flex w-full max-w-[280px] flex-col gap-4">
      <div className="flex items-center gap-2 font-body text-sm font-semibold uppercase text-nav-text dark:text-on-surface">
        <span>{lo.toLocaleString()}£</span>
        <span className="font-medium">-</span>
        <span>{hi.toLocaleString()}£</span>
      </div>
      <div className="flex flex-col gap-3">
        <label className="font-body text-xs text-on-surface-variant">
          Min
          <input
            type="range"
            min={min}
            max={max}
            value={lo}
            onChange={(e) => {
              const v = Number(e.target.value);
              setLo((_prev) => (v > hi ? hi : v));
            }}
            className="mt-1 w-full accent-primary"
          />
        </label>
        <label className="font-body text-xs text-on-surface-variant">
          Max
          <input
            type="range"
            min={min}
            max={max}
            value={hi}
            onChange={(e) => {
              const v = Number(e.target.value);
              setHi((_prev) => (v < lo ? lo : v));
            }}
            className="mt-1 w-full accent-primary"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
          <Link href={applyHref}>Apply</Link>
        </Button>
        <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
          <Link href={clearHref}>Reset</Link>
        </Button>
      </div>
    </div>
  );
}
