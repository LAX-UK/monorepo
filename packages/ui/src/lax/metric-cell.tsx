import { ArrowDown, ArrowUp, ChevronRight, Minus } from "lucide-react";
import type * as React from "react";
import { cn } from "../lib/utils.js";
import type { LinkComponent } from "./link.js";
import { Skeleton } from "./skeleton.js";
import { type MetricTone, Sparkline, SparklineSkeleton } from "./sparkline.js";

export type { MetricTone } from "./sparkline.js";

export type MetricComparison = {
  /** The change, formatted: "12%". Shown in the chip beside the trend. */
  text: string;
  direction: "up" | "down" | "flat";
  /** Whether the change is good news. The arrow carries the direction; colour only backs it up. */
  tone?: "positive" | "negative" | "neutral";
  /** What the change is measured against: "vs previous 30 days". Spoken, and shown on hover. */
  basis?: string;
};

export type Metric = {
  id: string;
  label: string;
  /** Already formatted, in full: "£1,250.00", never "£1.2k". Null when unknown: shows "—". */
  value: React.ReactNode | null;
  /**
   * What a missing value means, in words: "Nothing sold yet this year". Shown instead of the
   * dash, so a figure with no data never reads as a zero or a blank.
   */
  emptyText?: string;
  /** A 14px icon before the label, drawn in the metric's tone. */
  icon?: React.ReactNode;
  /**
   * What the number means for the person reading it: `attention` and `critical` mark work waiting
   * or something wrong, `positive` good news. Colours the icon, the trend line and a top accent.
   */
  tone?: MetricTone;
  comparison?: MetricComparison;
  /** A recent series behind the number, oldest first (e.g. one value a day). Real data only. */
  trend?: readonly number[];
  /** What the trend counts, shown on hover: "Lots ended each day, last 30 days". */
  trendLabel?: string;
  /** The list filtered to the records behind the number; the whole cell becomes the link. */
  href?: string;
};

/** A record page adds a short context line under the value. */
export type MetricCellItem = Metric & {
  /** "3 need photos", "Incl. buyer's premium". */
  hint?: React.ReactNode;
  hintTone?: "neutral" | "positive" | "negative";
};

const ARROW = { up: ArrowUp, down: ArrowDown, flat: Minus } as const;
const ARROW_LABEL = { up: "Up", down: "Down", flat: "No change" } as const;

const chipTone = {
  positive: "bg-lax-success-bg text-lax-success-fg",
  negative: "bg-lax-danger-bg text-lax-danger-fg",
  neutral: "bg-lax-neutral-bg text-lax-neutral-fg",
} as const;

const iconTone: Record<MetricTone, string> = {
  neutral: "text-lax-muted",
  positive: "text-lax-success-fg",
  attention: "text-lax-warning-fg",
  critical: "text-lax-danger-fg",
};

const accentTone: Partial<Record<MetricTone, string>> = {
  attention: "bg-lax-warning-dot",
  critical: "bg-lax-danger-dot",
};

const hintTone = {
  positive: "text-lax-success-fg",
  negative: "text-lax-danger-fg",
  neutral: "text-lax-subtle",
} as const;

/** Wide enough to hold the value, the change and the trend side by side. */
const TREND_WIDTH = 80;
const TREND_HEIGHT = 24;
/** The trend in a narrow cell, on the chip's row under the value. */
const COMPACT_TREND_WIDTH = 56;
const COMPACT_TREND_HEIGHT = 16;
/**
 * A value this long (such as "£5,638,464,102.00") would run into a trend or change beside it, so
 * the cell keeps them under the value, as it does when narrow. The figure is never shortened.
 */
const LONG_VALUE_LENGTH = 12;

export function isLongMetricValue(value: React.ReactNode | null | undefined): boolean {
  return typeof value === "string" && value.length >= LONG_VALUE_LENGTH;
}

/** The change as a chip: arrow and figure on a tinted ground, with the full sentence spoken. */
export function MetricDelta({
  comparison,
  className,
}: {
  comparison: MetricComparison;
  className?: string;
}) {
  const Arrow = ARROW[comparison.direction];
  const spoken = [ARROW_LABEL[comparison.direction], comparison.text, comparison.basis]
    .filter(Boolean)
    .join(" ");
  return (
    <span
      data-metric-delta={comparison.direction}
      title={comparison.basis ? `${comparison.text} ${comparison.basis}` : undefined}
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-0.5 rounded-lax-badge pr-1.5 pl-1 text-lax-12 font-medium tabular-nums",
        chipTone[comparison.tone ?? "neutral"],
        className,
      )}
    >
      <Arrow aria-hidden className="size-3" strokeWidth={2.25} />
      <span aria-hidden>{comparison.text}</span>
      <span className="sr-only">{spoken}</span>
    </span>
  );
}

/**
 * One number in a metric strip, a record's stat grid or the client's "At a glance" figures. The label (with an optional icon) sits over
 * the value; when there is a change or a trend they sit on the right, the chip above a small line
 * chart. Narrow cells (phones, four across a sidebar layout) stack the chip under the value and
 * drop the chart, so a number is never squeezed. With `href` the whole cell links to the list
 * behind the number. In the client workspace the cell is a figure: 28/36 at 600 with 20px by 24px of
 * padding, since it is the only figure surface clients see.
 */
export function MetricCell({
  item,
  Link,
  className,
}: {
  item: MetricCellItem;
  Link?: LinkComponent | undefined;
  className?: string;
}) {
  const tone = item.tone ?? "neutral";
  // Long values keep the change and trend under them; short ones put them in a column beside.
  const stackBeside = isLongMetricValue(item.value);
  const missing = item.value === null || item.value === undefined || item.value === "";
  const trend = !missing && item.trend && item.trend.length > 1 ? item.trend : null;
  const comparison = missing ? undefined : item.comparison;
  const linked = Boolean(item.href && Link);
  const accent = accentTone[tone];
  const valueText = missing ? (
    item.emptyText ? (
      <span className="block text-lax-14 font-medium whitespace-normal text-lax-fg in-data-[lax-density=client]:text-lax-16">
        {item.emptyText}
      </span>
    ) : (
      <span className="text-lax-subtle" title="No data">
        —<span className="sr-only">No data</span>
      </span>
    )
  ) : (
    item.value
  );

  return (
    <div
      data-metric-cell=""
      data-tone={tone}
      className={cn(
        "@container relative min-w-0",
        linked &&
          "transition-colors duration-150 ease-out hover:lax-overlay-hover active:lax-overlay-pressed has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:rounded-lax-card has-[a:focus-visible]:outline-lax-focus has-[a:focus-visible]:outline-solid",
        className,
      )}
    >
      {accent ? (
        <span aria-hidden className={cn("absolute inset-x-0 top-0 h-0.5", accent)} />
      ) : null}
      <dl
        className={cn(
          "h-full content-start gap-x-3 px-4 py-3",
          "in-data-[lax-density=client]:px-6 in-data-[lax-density=client]:py-5",
          comparison || trend
            ? // Narrow: the change and trend follow the value, on its line when they fit and on
              // the next when they do not. Wide: they take a column of their own on the right.
              cn(
                "flex flex-wrap items-end",
                !stackBeside &&
                  "@min-[15rem]:grid @min-[15rem]:grid-cols-[minmax(0,1fr)_auto] @min-[15rem]:items-stretch",
              )
            : "grid grid-cols-1",
        )}
      >
        <dt className="col-start-1 row-start-1 flex min-w-0 basis-full items-center gap-1.5 text-lax-12 text-lax-muted in-data-[lax-density=client]:text-lax-13">
          {item.icon ? (
            <span aria-hidden className={cn("flex shrink-0 [&_svg]:size-3.5", iconTone[tone])}>
              {item.icon}
            </span>
          ) : null}
          <span className="min-w-0 truncate" title={item.label}>
            {item.label}
          </span>
          {linked ? (
            <ChevronRight
              aria-hidden
              className="-ml-0.5 size-3 shrink-0 text-lax-subtle transition-transform duration-150 ease-out [[data-metric-cell]:hover_&]:translate-x-0.5 [[data-metric-cell]:hover_&]:text-lax-fg"
            />
          ) : null}
        </dt>
        <dd className="col-start-1 row-start-2 mt-0.5 min-w-0 in-data-[lax-density=client]:mt-2">
          <span
            title={typeof item.value === "string" && !linked ? item.value : undefined}
            className={cn(
              "block font-semibold whitespace-nowrap text-lax-fg tabular-nums",
              // A long figure steps down in a narrow cell instead of running past its edge.
              stackBeside
                ? "text-lax-13 @min-[12rem]:text-lax-14 @min-[13rem]:text-lax-16 @min-[18rem]:text-lax-20"
                : "text-lax-16 @min-[10rem]:text-lax-20 in-data-[lax-density=client]:@min-[10rem]:text-lax-28 in-data-[lax-density=client]:tracking-[-0.01em]",
            )}
          >
            {linked && item.href && Link ? (
              <Link
                href={item.href}
                className="outline-none after:absolute after:inset-0 after:content-['']"
              >
                <span className="sr-only">{item.label}: </span>
                {valueText}
              </Link>
            ) : (
              valueText
            )}
          </span>
          {item.hint ? (
            <span
              className={cn(
                "mt-0.5 block text-lax-12 in-data-[lax-density=client]:mt-1 in-data-[lax-density=client]:text-lax-13",
                hintTone[item.hintTone ?? "neutral"],
              )}
            >
              {item.hint}
            </span>
          ) : null}
        </dd>
        {comparison || trend ? (
          <dd
            title={trend ? item.trendLabel : undefined}
            className={cn(
              "flex min-w-0 grow items-center",
              // Narrow cells (and long values): the chip and a smaller trend share a row under
              // the value.
              "mt-1.5 min-h-5 justify-between gap-2",
              !stackBeside &&
                "@min-[15rem]:col-start-2 @min-[15rem]:row-span-2 @min-[15rem]:row-start-1 @min-[15rem]:mt-0 @min-[15rem]:min-h-0 @min-[15rem]:flex-col @min-[15rem]:items-end @min-[15rem]:gap-0.5",
              // With only a trend, the line sits level with the value.
              !comparison && !stackBeside && "@min-[15rem]:justify-end",
            )}
          >
            {comparison ? <MetricDelta comparison={comparison} /> : null}
            {trend ? (
              <>
                <Sparkline
                  values={trend}
                  tone={tone}
                  width={COMPACT_TREND_WIDTH}
                  height={COMPACT_TREND_HEIGHT}
                  className={cn("ml-auto", !stackBeside && "@min-[15rem]:hidden")}
                />
                {stackBeside ? null : (
                  <Sparkline
                    values={trend}
                    tone={tone}
                    width={TREND_WIDTH}
                    height={TREND_HEIGHT}
                    className="hidden @min-[15rem]:block"
                  />
                )}
              </>
            ) : null}
          </dd>
        ) : null}
      </dl>
    </div>
  );
}

/** A metric cell's placeholder at its final size, including the trend's box. */
export function MetricCellSkeleton({ trend = true }: { trend?: boolean }) {
  return (
    <div data-metric-cell="" className="@container min-w-0">
      <div
        className={cn(
          "grid grid-cols-1 gap-x-3 px-4 py-3",
          trend && "@min-[15rem]:grid-cols-[minmax(0,1fr)_auto]",
        )}
      >
        <div className="flex flex-col">
          <Skeleton className="my-0.5 h-3 w-20" />
          <Skeleton className="mt-1.5 mb-1 h-5 w-28" />
        </div>
        {trend ? (
          <div className="hidden flex-col items-end gap-0.5 @min-[15rem]:flex">
            <Skeleton className="h-5 w-12 rounded-lax-badge" />
            <SparklineSkeleton width={TREND_WIDTH} height={TREND_HEIGHT} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
