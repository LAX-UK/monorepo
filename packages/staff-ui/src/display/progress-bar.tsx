import { cn } from "../lib/cn.js";

/**
 * How far along something is, as a thin bar with a readable name ("12 of 40 lots complete").
 * The number it stands for belongs beside it in words; the bar only adds the shape.
 */
export function ProgressBar({
  value,
  max,
  label,
  className,
}: {
  value: number;
  max: number;
  /** What is counted: "Lots complete". Spoken with the numbers. */
  label: string;
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
        className="h-full rounded-full bg-staff-ink transition-[width] duration-200 ease-out motion-reduce:transition-none"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
