import { cn } from "../lib/utils.js";

export type MeterProps = {
  /** 0–100. */
  value: number;
  /** What is measured, with the figures: "£8,000 of £25,000 used". */
  label: string;
  className?: string;
};

/**
 * How much of a limit is in use: a thin track with an ink fill, turning to the warning colour
 * from 80% and the danger colour when it is full, so the state is never carried by length alone
 * (the label says it in words).
 */
export function Meter({ value, label, className }: MeterProps) {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  const tone =
    percent >= 100 ? "bg-lax-danger-solid" : percent >= 80 ? "bg-lax-warning-dot" : "bg-lax-ink";
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-lax-sunken", className)}
    >
      <div className={cn("h-full rounded-full", tone)} style={{ width: `${percent}%` }} />
    </div>
  );
}
