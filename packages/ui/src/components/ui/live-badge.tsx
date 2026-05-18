import { cn } from "../../lib/utils.js";

export type LiveBadgeProps = {
  className?: string;
  label?: string;
};

/** Live / time-critical status pill with optional pulse. */
export function LiveBadge({ className, label = "Live" }: LiveBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-live-red/30 bg-live-red/10 px-2 py-0.5 font-label text-[10px] font-semibold uppercase tracking-[0.18em] text-live-red",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-live-red motion-safe:animate-pulse" aria-hidden />
      {label}
    </span>
  );
}
