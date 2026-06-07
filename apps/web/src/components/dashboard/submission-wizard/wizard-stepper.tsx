"use client";

import { WIZARD_STEPS } from "@/lib/forms/submission/step-validation";
import { cn } from "@auction/ui";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetTrigger,
} from "@auction/ui/components/bottom-sheet";
import { Button } from "@auction/ui/components/button";
import { TimelineStages } from "@auction/ui/components/timeline-stages";
import { List } from "lucide-react";
import { useState } from "react";

type Props = {
  activeIndex: number;
  maxReachableIndex: number;
  onStepClick: (index: number) => void;
  onPrev?: () => void;
  onNext?: () => void;
  canGoPrev?: boolean;
  canGoNext?: boolean;
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
            <Button
              type="button"
              variant="ghost"
              disabled={!reachable}
              aria-current={active ? "step" : undefined}
              onClick={() => {
                if (!reachable) return;
                onStepClick(index);
                onSelectStep?.();
              }}
              className={cn(
                "flex h-auto min-h-11 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left font-body font-normal transition-colors focus-visible:bg-transparent focus-visible:text-inherit",
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
            </Button>
          </li>
        );
      })}
    </>
  );
}

export function WizardStepper({
  activeIndex,
  maxReachableIndex,
  onStepClick,
  onNext: _onNext,
  onPrev: _onPrev,
  canGoPrev: _canGoPrev = false,
  canGoNext = false,
}: Props) {
  const [stepsOpen, setStepsOpen] = useState(false);
  const currentLabel = WIZARD_STEPS[activeIndex]?.label ?? "";
  const nextLabel = WIZARD_STEPS[activeIndex + 1]?.label;
  const endowedBase = 100 / WIZARD_STEPS.length;
  const progressPercent = Math.min(
    100,
    endowedBase + (activeIndex / WIZARD_STEPS.length) * (100 - endowedBase),
  );

  return (
    <nav aria-label="Submission wizard progress" className="mb-6">
      <div className="lg:hidden">
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1 px-1">
            <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
              Step {activeIndex + 1} of {WIZARD_STEPS.length}
              {currentLabel ? ` · ${currentLabel}` : ""}
            </p>
            <h2 className="truncate font-headline text-lg text-on-surface">{currentLabel}</h2>
            {nextLabel && canGoNext ? (
              <p className="truncate font-body text-xs text-on-surface-variant">
                Up next: {nextLabel}
              </p>
            ) : null}
          </div>
          <BottomSheet open={stepsOpen} onOpenChange={setStepsOpen}>
            <BottomSheetTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="min-h-11 min-w-11 shrink-0"
                aria-label="Open all steps"
                data-testid="wizard-steps-menu"
              >
                <List className="size-5" aria-hidden />
              </Button>
            </BottomSheetTrigger>
            <BottomSheetContent className="max-h-[min(70dvh,32rem)] pb-[max(1rem,env(safe-area-inset-bottom))]">
              <BottomSheetHeader>
                <BottomSheetTitle className="font-headline text-left text-lg">
                  Steps
                </BottomSheetTitle>
              </BottomSheetHeader>
              <ol className="mt-4 flex flex-col gap-2 px-6 pb-6">
                <WizardStepList
                  activeIndex={activeIndex}
                  maxReachableIndex={maxReachableIndex}
                  onStepClick={onStepClick}
                  onSelectStep={() => setStepsOpen(false)}
                />
              </ol>
            </BottomSheetContent>
          </BottomSheet>
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
      </div>
      <TimelineStages
        className="hidden lg:flex"
        stages={WIZARD_STEPS.map((s) => ({ id: s.id, label: s.label }))}
        activeIndex={activeIndex}
      />
    </nav>
  );
}
