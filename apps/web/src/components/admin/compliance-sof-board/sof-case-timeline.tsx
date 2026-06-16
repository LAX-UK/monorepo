"use client";

import type { SofTimelineStep } from "@/lib/data/view-models/admin-sof-timeline.vm";
import { cn } from "@auction/ui/lib/utils";

type Props = {
  steps: SofTimelineStep[];
};

export function SofCaseTimeline({ steps }: Props) {
  if (steps.length === 1 && steps[0]?.id === "outcome") {
    const step = steps[0];
    return (
      <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low/40 px-4 py-3">
        <p className="font-headline text-sm font-semibold text-on-surface">{step.label}</p>
        {step.detail ? <p className="mt-1 text-sm text-on-surface-variant">{step.detail}</p> : null}
      </div>
    );
  }

  return (
    <nav
      aria-label="Case workflow"
      className="overflow-x-auto rounded-lg border border-outline-variant/40 p-4"
    >
      <ol className="flex min-w-max items-start gap-0 sm:gap-2">
        {steps.map((step, index) => (
          <li key={step.id} className="flex min-w-[9rem] items-start">
            <div className="flex min-w-[9rem] flex-col gap-1">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full font-label text-[10px] font-semibold",
                    step.state === "complete" && "bg-primary text-on-primary",
                    step.state === "current" && "border-2 border-primary text-primary",
                    step.state === "upcoming" &&
                      "border border-border-hairline text-on-surface-variant",
                  )}
                  aria-hidden
                >
                  {step.state === "complete" ? "✓" : index + 1}
                </span>
                <span
                  className={cn(
                    "font-body text-sm",
                    step.state === "current"
                      ? "font-medium text-on-surface"
                      : "text-on-surface-variant",
                  )}
                >
                  {step.label}
                </span>
              </div>
              {step.detail ? (
                <p className="pl-9 text-xs text-on-surface-variant">{step.detail}</p>
              ) : null}
              {step.turnLabel && step.state === "current" ? (
                <p className="pl-9 text-xs font-medium text-primary">{step.turnLabel}</p>
              ) : null}
            </div>
            {index < steps.length - 1 ? (
              <span
                className="mx-2 mt-3 hidden h-px w-8 shrink-0 bg-border-hairline sm:block"
                aria-hidden
              />
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
