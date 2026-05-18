"use client";

import { WIZARD_STEPS } from "@/lib/forms/submission/step-validation";
import { cn } from "@auction/ui";
import { TimelineStages } from "@auction/ui/components/timeline-stages";
import { useState } from "react";

type Props = {
  activeIndex: number;
  maxReachableIndex: number;
  onStepClick: (index: number) => void;
};

function WizardStepList({
  activeIndex,
  maxReachableIndex,
  onStepClick,
  onSelectStep,
}: {
  activeIndex: number;
  maxReachableIndex: number;
  onStepClick: (index: number) => void;
  onSelectStep?: () => void;
}) {
  return (
    <>
      {WIZARD_STEPS.map((step, index) => {
        const reachable = index <= maxReachableIndex;
        const active = index === activeIndex;
        return (
          <li key={step.id}>
            <button
              type="button"
              disabled={!reachable}
              aria-current={active ? "step" : undefined}
              onClick={() => {
                if (!reachable) return;
                onStepClick(index);
                onSelectStep?.();
              }}
              className={cn(
                "flex w-full min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                active && "border-primary/40 bg-primary/5",
                !active && reachable && "border-border-hairline hover:bg-surface-container-low",
                !reachable && "cursor-not-allowed opacity-50",
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full font-label text-xs font-bold",
                  active && "bg-primary text-on-primary ring-2 ring-primary/30",
                  !active && reachable && "bg-primary text-on-primary",
                  !reachable && "bg-surface-container-high text-on-surface-variant",
                )}
              >
                {index < activeIndex ? "✓" : index + 1}
              </span>
              <span className="font-label text-xs font-semibold uppercase tracking-wider">
                {step.label}
              </span>
            </button>
          </li>
        );
      })}
    </>
  );
}

export function WizardStepper({ activeIndex, maxReachableIndex, onStepClick }: Props) {
  const [isStepsOpen, setStepsOpen] = useState(false);
  const currentLabel = WIZARD_STEPS[activeIndex]?.label ?? "";
  const progressPercent = ((activeIndex + 1) / WIZARD_STEPS.length) * 100;

  return (
    <nav aria-label="Submission wizard progress" className="mb-6">
      <div className="sm:hidden">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
              Step {activeIndex + 1} of {WIZARD_STEPS.length}
            </p>
            <h2 className="truncate font-headline text-lg text-on-surface">{currentLabel}</h2>
          </div>
          <button
            type="button"
            onClick={() => setStepsOpen((open) => !open)}
            aria-expanded={isStepsOpen}
            aria-controls="wizard-steps-list"
            className="min-h-11 shrink-0 px-2 font-label text-xs font-semibold uppercase tracking-wider text-primary underline-offset-4 hover:underline"
          >
            {isStepsOpen ? "Hide" : "Steps"}
          </button>
        </div>
        <div
          className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-container-high"
          aria-hidden
        >
          <div
            className="h-full bg-primary transition-[width] duration-200 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {isStepsOpen ? (
          <ol id="wizard-steps-list" className="mt-3 flex flex-col gap-2">
            <WizardStepList
              activeIndex={activeIndex}
              maxReachableIndex={maxReachableIndex}
              onStepClick={onStepClick}
              onSelectStep={() => setStepsOpen(false)}
            />
          </ol>
        ) : null}
      </div>
      <TimelineStages
        className="hidden sm:flex"
        stages={WIZARD_STEPS.map((s) => ({ id: s.id, label: s.label }))}
        activeIndex={activeIndex}
      />
    </nav>
  );
}
