"use client";

import type { CalendarSalesUrlState } from "@/lib/marketing/sales-calendar-params";
import { calendarSalesHrefFromState } from "@/lib/marketing/sales-calendar-params";
import { Button } from "@auction/ui";
import { Slider } from "@auction/ui/components/slider";
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
    () => calendarSalesHrefFromState(state, { minPrice: lo, maxPrice: hi, page: undefined }),
    [state, lo, hi],
  );

  const clearHref = useMemo(
    () =>
      calendarSalesHrefFromState(state, {
        minPrice: undefined,
        maxPrice: undefined,
        page: undefined,
      }),
    [state],
  );

  return (
    <div className="flex w-full max-w-[280px] flex-col gap-4">
      <div className="flex items-center gap-2 font-body text-sm font-semibold uppercase text-nav-text dark:text-on-surface">
        <span>{lo.toLocaleString()}£</span>
        <span className="font-medium">-</span>
        <span>{hi.toLocaleString()}£</span>
      </div>
      <Slider
        min={min}
        max={max}
        value={[lo, hi]}
        onValueChange={(values) => {
          const [nextLo, nextHi] = values;
          if (nextLo !== undefined) setLo(nextLo);
          if (nextHi !== undefined) setHi(nextHi);
        }}
        className="py-2"
      />
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
