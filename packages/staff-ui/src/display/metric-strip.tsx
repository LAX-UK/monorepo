import { type LinkComponent, type Metric, MetricCell, MetricCellSkeleton } from "@auction/ui/lax";
import type * as React from "react";
import { cn } from "../lib/cn.js";

export type { Metric, MetricComparison, MetricTone } from "@auction/ui/lax";

/** The most metrics a strip shows; more than this is a report, not a summary. */
export const METRIC_STRIP_MAX = 4;

const mdColumns: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
};

/** Hairlines between cells: two across on phones, one row from 768px. */
export function metricCellDividers(index: number) {
  return cn(
    index % 2 === 1 && "border-l border-staff-line-subtle",
    index >= 2 && "border-t border-staff-line-subtle md:border-t-0",
    index >= 1 && "md:border-l",
  );
}

/**
 * A list's summary: up to four numbers in one bordered row. Each cell has a label (with an
 * optional icon), the value in tabular figures and, when the data exists, the change as a chip
 * and the recent trend as a small line, coloured by the metric's tone. The period the numbers
 * cover is stated in a caption above the row.
 */
export function MetricStrip({
  items,
  label,
  period,
  action,
  loading = false,
  placeholders,
  Link,
  className,
}: {
  items: readonly Metric[];
  /** Accessible name: "Payments summary". */
  label: string;
  /** What the numbers cover: "Last 30 days", "Matching the current filters". */
  period: React.ReactNode;
  /** A control beside the period, e.g. a period menu when the period applies to the numbers only. */
  action?: React.ReactNode;
  /** Placeholders of the final size while the numbers load. */
  loading?: boolean;
  /** How many placeholders to show while loading with no items yet; defaults to four. */
  placeholders?: number;
  /** Needed when metrics carry an `href`. */
  Link?: LinkComponent;
  className?: string;
}) {
  const shown = items.slice(0, METRIC_STRIP_MAX);
  const count =
    loading && shown.length === 0
      ? Math.min(placeholders ?? METRIC_STRIP_MAX, METRIC_STRIP_MAX)
      : shown.length;
  if (count === 0) return null;
  return (
    <section
      aria-label={label}
      aria-busy={loading || undefined}
      className={cn("flex flex-col gap-2", className)}
    >
      <div className="flex min-h-5 items-center justify-between gap-3 px-0.5">
        <p className="text-staff-xs text-staff-muted">{period}</p>
        {action ? <div className="-my-1.5 flex shrink-0 items-center">{action}</div> : null}
      </div>
      <div
        className={cn(
          "grid overflow-hidden rounded-staff-lg border border-staff-line bg-staff-surface",
          count === 1 ? "grid-cols-1" : "grid-cols-2",
          mdColumns[count],
        )}
      >
        {loading
          ? Array.from({ length: count }, (_, index) => `placeholder-${index}`).map((id, index) => (
              <div
                key={id}
                className={cn(
                  metricCellDividers(index),
                  count > 1 && count % 2 === 1 && index === count - 1 && "col-span-2 md:col-span-1",
                )}
              >
                <MetricCellSkeleton />
              </div>
            ))
          : shown.map((item, index) => (
              <MetricCell
                key={item.id}
                item={item}
                Link={Link}
                className={cn(
                  metricCellDividers(index),
                  // An odd last cell on phones takes the whole row rather than leaving a hole.
                  count > 1 && count % 2 === 1 && index === count - 1 && "col-span-2 md:col-span-1",
                )}
              />
            ))}
      </div>
    </section>
  );
}
