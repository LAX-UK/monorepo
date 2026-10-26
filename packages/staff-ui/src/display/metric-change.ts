import type { MetricComparison } from "./metric-cell.js";

/**
 * The change between two periods as a metric comparison: "12%" up or down, toned by whether a rise
 * is good news. Returns nothing when there is no earlier figure to compare with, since a change
 * from zero has no meaningful percentage.
 */
export function metricChange({
  current,
  prior,
  basis,
  rise = "neutral",
}: {
  current: number;
  prior: number;
  /** "vs previous 30 days". */
  basis: string;
  /** Whether a rise is good news (`good`), bad news (`bad`) or neither. */
  rise?: "good" | "bad" | "neutral";
}): MetricComparison | undefined {
  if (!Number.isFinite(current) || !Number.isFinite(prior) || prior <= 0) return undefined;
  const percent = Math.round((Math.abs(current - prior) / prior) * 100);
  const direction = percent === 0 ? "flat" : current > prior ? "up" : "down";
  const good = rise === "good" ? "up" : rise === "bad" ? "down" : null;
  const tone =
    direction === "flat" || good === null
      ? "neutral"
      : direction === good
        ? "positive"
        : "negative";
  return { text: percent > 999 ? ">999%" : `${percent}%`, direction, tone, basis };
}
