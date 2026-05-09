import { cn } from "../../lib/utils.js";

export type SparklineProps = {
  /** Normalized 0–1 series; empty renders a flat line */
  values: readonly number[];
  className?: string;
  /** Stroke color — CSS color or token class applied via stroke-current */
  tone?: "primary" | "lot-orange" | "live-red" | "secondary";
  width?: number;
  height?: number;
  "aria-hidden"?: boolean;
};

const toneClass: Record<NonNullable<SparklineProps["tone"]>, string> = {
  primary: "text-primary",
  "lot-orange": "text-lot-orange",
  "live-red": "text-live-red",
  secondary: "text-secondary",
};

export function Sparkline({
  values,
  className,
  tone = "primary",
  width = 64,
  height = 24,
  "aria-hidden": ariaHidden = true,
}: SparklineProps) {
  const pad = 1;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const series = values.length > 0 ? [...values] : [0.5];
  const min = Math.min(...series, 0);
  const max = Math.max(...series, 1);
  const range = max - min || 1;
  const step = w / Math.max(series.length - 1, 1);
  const points = series
    .map((v, i) => {
      const x = pad + i * step;
      const n = (v - min) / range;
      const y = pad + h - n * h;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: <explanation>
    <svg
      width={width}
      height={height}
      className={cn("shrink-0 overflow-visible", toneClass[tone], className)}
      aria-hidden={ariaHidden}
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
