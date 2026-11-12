import type * as React from "react";
import { cn } from "../lib/cn.js";

/** Where a step stands: done, the one in hand, still to come, or ended without finishing. */
export type StepState = "done" | "current" | "todo" | "stopped";

export type StepItem = {
  id: string;
  /** What the step is: "Seller's agreement". */
  label: string;
  /** Facts under the label, one per line: who did it, what was said. */
  details?: readonly string[];
  /** A date or deadline, shown at the end of the row. */
  meta?: string | null;
  state: StepState;
};

const STATE_WORD: Record<StepState, string> = {
  done: "Done",
  current: "In progress",
  todo: "Not started",
  stopped: "Stopped",
};

const DOT: Record<StepState, string> = {
  done: "bg-staff-success-dot",
  current: "bg-staff-ink",
  todo: "border border-staff-control-border bg-transparent",
  stopped: "bg-staff-danger-dot",
};

/**
 * A short process as a list of steps, each with a state dot, its facts and its date: the way a
 * record page tells where something stands (an offer, a refund, an onboarding). The state is
 * also read out, so colour is never the only signal.
 */
export function StepList({
  items,
  label,
  className,
}: {
  items: readonly StepItem[];
  label: string;
  className?: string;
}) {
  return (
    <ol aria-label={label} className={cn("divide-y divide-staff-line-subtle", className)}>
      {items.map((item) => (
        <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
          <span
            aria-hidden
            className={cn("mt-[5px] size-2.5 shrink-0 rounded-full", DOT[item.state])}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-staff-sm font-medium text-staff-fg">
                {item.label}
                <span className="sr-only">. {STATE_WORD[item.state]}</span>
              </p>
              {item.details?.map((line) => (
                <p key={line} className="text-staff-xs text-staff-muted">
                  {line}
                </p>
              ))}
            </div>
            {item.meta ? (
              <p className="shrink-0 text-staff-xs text-staff-muted sm:text-right">{item.meta}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export type StepListProps = React.ComponentProps<typeof StepList>;
