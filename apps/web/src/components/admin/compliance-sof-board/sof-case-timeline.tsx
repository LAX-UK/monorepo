"use client";

import type { SofTimelineStep } from "@/lib/data/view-models/admin-sof-timeline.vm";
import { Check } from "lucide-react";

type Props = {
  steps: SofTimelineStep[];
};

const MARKER = {
  complete:
    "flex size-6 shrink-0 items-center justify-center rounded-full bg-staff-ink text-staff-xs font-semibold text-staff-on-ink",
  current:
    "flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-staff-ink text-staff-xs font-semibold text-staff-fg",
  upcoming:
    "flex size-6 shrink-0 items-center justify-center rounded-full border border-staff-control-border text-staff-xs font-semibold text-staff-muted",
} as const;

/** Where the case is in its review: each step, which one is current and whose turn it is. */
export function SofCaseTimeline({ steps }: Props) {
  if (steps.length === 1 && steps[0]?.id === "outcome") {
    const step = steps[0];
    return (
      <div className="rounded-staff-lg border border-staff-line bg-staff-surface px-4 py-3">
        <p className="text-staff-md font-semibold text-staff-fg">{step.label}</p>
        {step.detail ? <p className="mt-1 text-staff-sm text-staff-muted">{step.detail}</p> : null}
      </div>
    );
  }

  return (
    <nav
      aria-label="Case workflow"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a horizontally scrollable region must be keyboard-scrollable (WCAG 2.1.1).
      tabIndex={0}
      className="overflow-x-auto rounded-staff-lg border border-staff-line bg-staff-surface p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-staff-focus"
    >
      <ol className="flex min-w-max items-start gap-2">
        {steps.map((step, index) => (
          <li key={step.id} className="flex min-w-[9rem] items-start">
            <div className="flex min-w-[9rem] flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className={MARKER[step.state]} aria-hidden>
                  {step.state === "complete" ? <Check className="size-3.5" /> : index + 1}
                </span>
                <span
                  className={
                    step.state === "current"
                      ? "text-staff-sm font-medium text-staff-fg"
                      : "text-staff-sm text-staff-muted"
                  }
                >
                  {step.label}
                  {step.state === "current" ? (
                    <span className="sr-only"> (current step)</span>
                  ) : null}
                </span>
              </div>
              {step.detail ? (
                <p className="pl-8 text-staff-xs text-staff-muted">{step.detail}</p>
              ) : null}
              {step.turnLabel && step.state === "current" ? (
                <p className="pl-8 text-staff-xs font-medium text-staff-fg">{step.turnLabel}</p>
              ) : null}
            </div>
            {index < steps.length - 1 ? (
              <span className="mx-2 mt-3 h-px w-8 shrink-0 bg-staff-line" aria-hidden />
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
