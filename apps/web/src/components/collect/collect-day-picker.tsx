"use client";

import { WEEKDAY_HEADINGS, calendarCells, windowHeading } from "@/lib/collect/collect-calendar";
import { COLLECT_COPY } from "@/lib/collect/collect-copy";
import type { CollectionDayView } from "@auction/types";
import { cn } from "@auction/ui";
import { useMemo } from "react";
import { RadioGrid, type RadioGridItem } from "./radio-grid";

const CHOICE =
  "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lax-control border px-1 py-1.5 text-center transition-[border-color,box-shadow,background-color] duration-150 ease-out motion-reduce:transition-none lax-focus";

/** A day's look: chosen is the 2px ink edge, a day with no time is quiet and says why in words. */
function dayClass({ checked, disabled }: { checked: boolean; disabled: boolean }): string {
  return cn(
    CHOICE,
    disabled
      ? "cursor-not-allowed border-lax-line bg-lax-sunken text-lax-muted"
      : "border-lax-line-strong bg-lax-surface text-lax-fg hover:border-lax-control-edge",
    checked && "border-lax-ink shadow-[inset_0_0_0_1px_var(--lax-ink)]",
  );
}

/**
 * The next four weeks, one row to a week, Monday first. Each day reads its state in words ("7
 * times", "Full", "Sale day", "Closed", "Too soon"), not by colour. A radio group: arrow keys move
 * and choose, and every label is read out in full.
 */
export function CollectDayPicker({
  days,
  value,
  onValueChange,
  now,
}: {
  days: readonly CollectionDayView[];
  value: string | null;
  onValueChange: (date: string) => void;
  now: Date;
}) {
  const cells = useMemo(() => calendarCells(days, now), [days, now]);
  const items: RadioGridItem[] = cells.days.map((day) => ({
    id: day.date,
    label: day.label,
    disabled: !day.selectable,
    className: dayClass,
    content: (
      <>
        <span className="text-lax-16 font-semibold tabular-nums">{day.number}</span>
        <span className="text-lax-12 leading-4">{day.caption}</span>
      </>
    ),
  }));
  return (
    <div className="flex flex-col gap-3">
      <p className="text-lax-14 font-medium text-lax-fg">{windowHeading(days)}</p>
      <div>
        <div aria-hidden className="mb-1 grid grid-cols-7 gap-1.5 sm:gap-2">
          {WEEKDAY_HEADINGS.map((heading) => (
            <span key={heading} className="text-center text-lax-12 font-medium text-lax-muted">
              {heading}
            </span>
          ))}
        </div>
        <RadioGrid
          id="collect-day"
          label={`${COLLECT_COPY.panels.day}, ${COLLECT_COPY.panels.dayHint.toLowerCase()}`}
          items={items}
          value={value}
          onValueChange={onValueChange}
          leadingBlanks={cells.blanks}
          className="grid grid-cols-7 gap-1.5 sm:gap-2"
        />
      </div>
    </div>
  );
}
