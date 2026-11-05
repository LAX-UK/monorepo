import { cn } from "../lib/cn.js";

export type ProgressTone = "neutral" | "warning" | "danger";

/** The fill colour per tone: extend here rather than branching in the component. */
const FILL_BY_TONE: Record<ProgressTone, string> = {
  neutral: "bg-staff-ink",
  warning: "bg-staff-warning-dot",
  danger: "bg-staff-danger-dot",
};

/**
 * How far along something is, as a thin bar with a readable name ("12 of 40 lots complete").
 * The number it stands for belongs beside it in words; the bar only adds the shape.
 */
export function ProgressBar({
  value,
  max,
  label,
  tone = "neutral",
  className,
}: {
  value: number;
  max: number;
  /** What is counted: "Lots complete". Spoken with the numbers. */
  label: string;
  /** Neutral by default; warning or danger when the time or allowance is running out. */
  tone?: ProgressTone;
  className?: string;
}) {
  const safeMax = Math.max(0, max);
  const safeValue = Math.min(Math.max(0, value), safeMax);
  const percent = safeMax > 0 ? Math.round((safeValue / safeMax) * 100) : 0;
  return (
    // biome-ignore lint/a11y/useFocusableInteractive: a read-only indicator, not a widget
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={safeValue}
      aria-valuetext={`${safeValue} of ${safeMax}`}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-staff-sunken", className)}
    >
      <div
        data-tone={tone}
        className={cn(
          "h-full rounded-full transition-[width] duration-200 ease-out motion-reduce:transition-none",
          FILL_BY_TONE[tone],
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
