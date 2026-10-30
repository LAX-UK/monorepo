import { useId } from "react";
import { cn } from "../lib/utils.js";

export type MetricTone = "neutral" | "positive" | "attention" | "critical";

/** The line colour for each tone; the area under it is the same colour, faded. */
export const sparklineToneClass: Record<MetricTone, string> = {
  neutral: "text-lax-muted",
  positive: "text-lax-success-dot",
  attention: "text-lax-warning-dot",
  critical: "text-lax-danger-dot",
};

/** Fewer points than this is not a trend. */
const MIN_POINTS = 2;

/** Inset so the 1.5px stroke and the end marker are never clipped by the box. */
const PAD = 3;

/** The points of the line, scaled to the box. Zero sits on the baseline unless values go below it. */
export function sparklinePoints(
  values: readonly number[],
  width: number,
  height: number,
): Array<[number, number]> {
  const series = values.filter((value) => Number.isFinite(value));
  if (series.length < MIN_POINTS) return [];
  const min = Math.min(0, ...series);
  const max = Math.max(...series);
  const range = max - min;
  const innerWidth = width - PAD * 2;
  const innerHeight = height - PAD * 2;
  const step = innerWidth / (series.length - 1);
  return series.map((value, index) => {
    // All zeros (no activity) lie along the floor.
    const share = range === 0 ? 0 : (value - min) / range;
    return [
      Number((PAD + index * step).toFixed(2)),
      Number((PAD + innerHeight - share * innerHeight).toFixed(2)),
    ];
  });
}

/**
 * A small line chart of a recent series, for a metric cell: a 1.5px line, a soft fill under it and
 * the latest point marked. Decorative; the cell states the number and its change in words.
 * Renders nothing for fewer than two points, so a metric without history keeps its space.
 */
export function Sparkline({
  values,
  tone = "neutral",
  width = 80,
  height = 24,
  className,
}: {
  values: readonly number[];
  tone?: MetricTone;
  width?: number;
  height?: number;
  className?: string;
}) {
  const gradientId = useId();
  const points = sparklinePoints(values, width, height);
  if (points.length === 0) return null;
  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x} ${y}`).join(" ");
  const first = points[0] as [number, number];
  const last = points[points.length - 1] as [number, number];
  const floor = height - PAD;
  const area = `${line} L${last[0]} ${floor} L${first[0]} ${floor} Z`;
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative; the cell states the number and change in words
    <svg
      aria-hidden
      focusable="false"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      data-tone={tone}
      className={cn("block shrink-0 overflow-visible", sparklineToneClass[tone], className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.18} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last[0]} cy={last[1]} r={2} fill="currentColor" />
    </svg>
  );
}

/** The sparkline's placeholder while numbers load: the same box, a gentle wave in skeleton grey. */
export function SparklineSkeleton({
  width = 80,
  height = 24,
  className,
}: {
  width?: number;
  height?: number;
  className?: string;
}) {
  const mid = height / 2;
  const wave = `M${PAD} ${mid + 3} C${width * 0.2} ${mid - 6}, ${width * 0.35} ${mid + 8}, ${
    width * 0.5
  } ${mid} S${width * 0.8} ${mid - 7}, ${width - PAD} ${mid - 3}`;
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: a loading placeholder, hidden from assistive technology
    <svg
      aria-hidden
      focusable="false"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("block shrink-0 animate-pulse text-lax-neutral-bg", className)}
    >
      <path
        d={wave}
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
