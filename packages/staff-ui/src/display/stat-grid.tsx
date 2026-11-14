import { type LinkComponent, MetricCell, type MetricCellItem } from "@auction/ui/lax";
import type * as React from "react";
import { cn } from "../lib/cn.js";

/** A record's headline number: the metric cell, with an optional context line under the value. */
export type StatItem = MetricCellItem;

/** Static class names, so Tailwind sees them. */
const WIDE_COLUMNS = { 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4" } as const;
const NARROW_COLUMNS = { 1: "grid-cols-1", 2: "grid-cols-2" } as const;

/**
 * Headline numbers for a record, in one hairline card divided into cells. Each cell is the same
 * metric cell as a list's metric strip (label, value in tabular figures, and the change and trend
 * when given), plus an optional hint line, so numbers read the same on lists and records.
 */
export function StatGrid({
  items,
  label,
  period,
  Link,
  columns,
  narrowColumns = 2,
  className,
}: {
  items: readonly StatItem[];
  label: string;
  /** What any trends cover, as a caption above the card: "Daily activity, last 30 days". */
  period?: React.ReactNode;
  /** Needed when items carry an `href`. */
  Link?: LinkComponent;
  /**
   * Cells per row from the medium breakpoint up. Defaults to the number of items (2 to 4), so a
   * strip of 3 stats has 3 columns and no empty cell; 5 or more items wrap at 4.
   */
  columns?: keyof typeof WIDE_COLUMNS;
  /** Cells per row below the medium breakpoint; 1 gives long values (dates) the full width. Default 2. */
  narrowColumns?: keyof typeof NARROW_COLUMNS;
  className?: string;
}) {
  const wide = columns ?? (Math.min(Math.max(items.length, 2), 4) as keyof typeof WIDE_COLUMNS);
  const grid = (
    <div
      className={cn(
        "grid gap-px overflow-hidden rounded-staff-lg border border-staff-line bg-staff-line-subtle",
        NARROW_COLUMNS[narrowColumns],
        WIDE_COLUMNS[wide],
      )}
    >
      {items.map((item) => (
        <MetricCell key={item.id} item={item} Link={Link} className="bg-staff-surface" />
      ))}
    </div>
  );
  return (
    <section aria-label={label} className={cn(period ? "flex flex-col gap-2" : null, className)}>
      {period ? (
        <p className="flex min-h-5 items-center px-0.5 text-staff-xs text-staff-muted">{period}</p>
      ) : null}
      {grid}
    </section>
  );
}
