import type * as React from "react";
import { cn } from "../lib/cn.js";
import type { StaffLinkComponent } from "../shell/link.js";
import { Skeleton } from "./states.js";

/** The most metrics a strip shows; more than this is a report, not a summary. */
export const METRIC_STRIP_MAX = 4;

export type MetricComparison = {
  /** "12% vs previous 30 days". Shown only when the comparison means something. */
  text: string;
  direction: "up" | "down" | "flat";
  /** Whether the change is good news; colour backs up the arrow, never replaces it. */
  tone?: "positive" | "negative" | "neutral";
};

export type Metric = {
  id: string;
  label: string;
  /** Already formatted, in full: "£1,250.00", never "£1.2k". */
  value: React.ReactNode;
  comparison?: MetricComparison;
  /** The list filtered to the records behind the number. */
  href?: string;
};

const ARROW = { up: "▲", down: "▼", flat: "–" } as const;
const ARROW_LABEL = { up: "Up", down: "Down", flat: "No change" } as const;

const mdColumns: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
};

const toneClass = {
  positive: "text-staff-success-fg",
  negative: "text-staff-danger-fg",
  neutral: "text-staff-muted",
} as const;

/**
 * A list's summary: up to four numbers in one bordered row, each with a label, a value at 20px in
 * tabular figures and, only when it means something, a comparison with an arrow. The period the
 * numbers cover is always stated. No sparklines, no separate floating cards.
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
  Link?: StaffLinkComponent;
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
      className={cn("rounded-staff-md border border-staff-line bg-staff-surface", className)}
    >
      <div className="flex min-h-9 items-center justify-between gap-3 border-b border-staff-line-subtle px-4 py-1.5">
        <p className="text-staff-xs text-staff-muted">{period}</p>
        {action ? <div className="flex shrink-0 items-center">{action}</div> : null}
      </div>
      <dl className={cn("grid", count === 1 ? "grid-cols-1" : "grid-cols-2", mdColumns[count])}>
        {(loading
          ? Array.from({ length: count }, (_, index) => ({ id: `loading-${index}` }) as Metric)
          : shown
        ).map((item, index) => (
          <div
            key={item.id}
            className={cn(
              "flex min-w-0 flex-col gap-0.5 px-4 py-3",
              // Hairlines between cells: left on every cell but the first of a row.
              index % 2 === 1 && "border-l border-staff-line-subtle",
              index >= 2 && "border-t border-staff-line-subtle md:border-t-0",
              index >= 1 && "md:border-l",
            )}
          >
            {loading ? (
              <>
                <Skeleton className="my-0.5 h-3 w-20" />
                <Skeleton className="my-1 h-5 w-28" />
              </>
            ) : (
              <MetricCell item={item} Link={Link} />
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}

function MetricCell({ item, Link }: { item: Metric; Link: StaffLinkComponent | undefined }) {
  const value = (
    <span className="text-staff-xl font-semibold text-staff-fg tabular-nums">{item.value}</span>
  );
  return (
    <>
      <dt className="truncate text-staff-xs text-staff-muted">{item.label}</dt>
      <dd className="flex min-w-0 flex-wrap items-baseline gap-x-2">
        {item.href && Link ? (
          <Link
            href={item.href}
            className="staff-focus rounded-staff-xs decoration-staff-line-strong underline-offset-4 hover:underline"
          >
            {value}
          </Link>
        ) : (
          value
        )}
        {item.comparison ? (
          <span
            className={cn(
              "inline-flex items-baseline gap-1 text-staff-xs",
              toneClass[item.comparison.tone ?? "neutral"],
            )}
          >
            <span aria-hidden className="text-staff-2xs leading-none">
              {ARROW[item.comparison.direction]}
            </span>
            <span className="sr-only">{ARROW_LABEL[item.comparison.direction]}: </span>
            {item.comparison.text}
          </span>
        ) : null}
      </dd>
    </>
  );
}
