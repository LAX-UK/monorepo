"use client";

import { WIZARD_STEPS } from "@/lib/forms/submission/step-validation";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@auction/ui/components/sheet";
import { TimelineStages } from "@auction/ui/components/timeline-stages";
import { ChevronLeft, ChevronRight, List } from "lucide-react";

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

export function WizardStepper({
  activeIndex,
  maxReachableIndex,
  onStepClick,
  onPrev,
  onNext,
  canGoPrev = false,
  canGoNext = false,
}: Props) {
  const currentLabel = WIZARD_STEPS[activeIndex]?.label ?? "";
  const nextLabel = WIZARD_STEPS[activeIndex + 1]?.label;
  const progressPercent = ((activeIndex + 1) / WIZARD_STEPS.length) * 100;

  return (
    <nav aria-label="Submission wizard progress" className="mb-6">
      <div className="sm:hidden">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 shrink-0"
            disabled={!canGoPrev}
            onClick={onPrev}
            aria-label="Previous step"
            data-testid="wizard-step-prev"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </Button>
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
          <Sheet>
            <SheetTrigger asChild>
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
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="max-h-[min(70dvh,32rem)] rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
            >
              <SheetHeader>
                <SheetTitle className="font-headline text-left text-lg">Steps</SheetTitle>
              </SheetHeader>
              <ol className="mt-4 flex max-h-[50dvh] flex-col gap-2 overflow-y-auto">
                <WizardStepList
                  activeIndex={activeIndex}
                  maxReachableIndex={maxReachableIndex}
                  onStepClick={onStepClick}
                />
              </ol>
            </SheetContent>
          </Sheet>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 shrink-0"
            disabled={!canGoNext}
            onClick={onNext}
            aria-label="Next step"
            data-testid="wizard-step-next"
          >
            <ChevronRight className="size-5" aria-hidden />
          </Button>
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
        className="hidden sm:flex"
        stages={WIZARD_STEPS.map((s) => ({ id: s.id, label: s.label }))}
        activeIndex={activeIndex}
      />
    </nav>
  );
}
