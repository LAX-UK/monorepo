"use client";
import { cn } from "../../lib/utils.js";

export type TimelineStage = {
  id: string;
  label: string;
};

export type TimelineStagesProps = {
  stages: readonly TimelineStage[];
  /** Index of active stage (0-based), or -1 if none */
  activeIndex: number;
  className?: string;
};

/** Horizontal stepper at sm+; vertical stack on &lt;sm. Keyboard: Tab through stages (decorative) or use roving tabindex on parent.
 */
export function TimelineStages({ stages, activeIndex, className }: TimelineStagesProps) {
  return (
    <ol
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-0 sm:gap-y-2",
        className,
      )}
      aria-label="Progress"
    >
      {stages.map((stage, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        const pending = i > activeIndex;
        return (
          <li
            key={stage.id}
            className={cn(
              "flex min-h-11 min-w-0 items-center gap-2 rounded-md border px-3 py-2 sm:min-h-0 sm:border-0 sm:px-2 sm:py-0",
              done && "border-outline-variant/20 bg-surface-container-low sm:bg-transparent",
              active &&
                "border-primary/40 bg-primary/5 ring-1 ring-primary/20 sm:border-0 sm:bg-transparent sm:ring-0",
              pending &&
                "border-outline-variant/10 bg-surface-container-lowest/50 sm:bg-transparent",
            )}
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full font-label text-xs font-bold",
                done && "bg-primary text-on-primary",
                active && "bg-lot-orange text-white ring-2 ring-lot-orange/40",
                pending && "bg-surface-container-high text-on-surface-variant",
              )}
              aria-current={active ? "step" : undefined}
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              className={cn(
                "min-w-0 truncate font-label text-[10px] font-bold uppercase tracking-wider sm:text-xs",
                active ? "text-on-surface" : "text-on-surface-variant",
              )}
            >
              {stage.label}
            </span>
            {i < stages.length - 1 ? (
              <span
                className="mx-1 hidden h-px w-6 shrink-0 bg-outline-variant/30 sm:block"
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
