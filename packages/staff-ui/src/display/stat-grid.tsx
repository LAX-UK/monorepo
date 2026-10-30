import { type LinkComponent, MetricCell, type MetricCellItem } from "@auction/ui/lax";
import type * as React from "react";
import { cn } from "../lib/cn.js";

/** A record's headline number: the metric cell, with an optional context line under the value. */
export type StatItem = MetricCellItem;

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
  className,
}: {
  items: readonly StatItem[];
  label: string;
  /** What any trends cover, as a caption above the card: "Daily activity, last 30 days". */
  period?: React.ReactNode;
  /** Needed when items carry an `href`. */
  Link?: LinkComponent;
  className?: string;
}) {
  const grid = (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-staff-lg border border-staff-line bg-staff-line-subtle md:grid-cols-4">
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
