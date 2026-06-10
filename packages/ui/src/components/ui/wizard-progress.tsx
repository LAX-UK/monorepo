"use client";

import { List } from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "../../lib/utils.js";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetTrigger,
} from "./bottom-sheet.js";
import { Button } from "./button.js";

export type WizardProgressStep = {
  id: string;
  label: string;
  /** Optional per-step time hint, e.g. 1 for "~1 min". */
  estimatedMinutes?: number;
};

export type WizardProgressVariant = "bar" | "chips";

export type WizardProgressProps = {
  steps: readonly WizardProgressStep[];
  currentIndex: number;
  /** Highest step the user may jump to. Defaults to last step (all reachable). */
  maxReachableIndex?: number;
  /** When set, marks steps complete by id (overrides index-based done state). */
  completedStepIds?: readonly string[];
  /** When provided, steps become clickable (subject to `maxReachableIndex`). */
  onStepClick?: (index: number) => void;
  /** Disable all step navigation interactions (e.g. while validating a jump). */
  stepNavigationDisabled?: boolean;
  variant?: WizardProgressVariant;
  /** "bar" only: render a mobile bottom-sheet step list trigger. */
  enableMobileSheet?: boolean;
  /** "bar" only: optional content below step chips inside the mobile sheet. */
  sidebarContent?: ReactNode;
  /** "bar" only: show "Up next: {label}" hint. */
  showUpNext?: boolean;
  className?: string;
};

function StepHeader({
  current,
  currentIndex,
  stepCount,
}: {
  current: WizardProgressStep | undefined;
  currentIndex: number;
  stepCount: number;
}) {
  return (
    <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
      Step {currentIndex + 1} of {stepCount}
      {current?.label ? ` · ${current.label}` : ""}
      {current?.estimatedMinutes != null ? ` · ~${current.estimatedMinutes} min` : ""}
    </p>
  );
}

function WizardStepChips({
  steps,
  currentIndex,
  maxReachableIndex,
  completedStepIds,
  onStepClick,
  stepNavigationDisabled,
  onSelectStep,
  fullWidth = false,
}: {
  steps: readonly WizardProgressStep[];
  currentIndex: number;
  maxReachableIndex: number;
  completedStepIds?: readonly string[] | undefined;
  onStepClick?: ((index: number) => void) | undefined;
  stepNavigationDisabled?: boolean | undefined;
  onSelectStep?: (() => void) | undefined;
  fullWidth?: boolean | undefined;
}) {
  return (
    <>
      {steps.map((step, index) => {
        const reachable = index <= maxReachableIndex;
        const active = index === currentIndex;
        const done = completedStepIds ? completedStepIds.includes(step.id) : index < currentIndex;
        const content = (
          <>
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full font-label text-[10px] font-bold",
                active && "bg-primary text-on-primary",
                done && !active && "bg-success/15 text-success",
                !active && !done && "bg-surface-container-high text-on-surface-variant",
              )}
              aria-hidden
            >
              {done ? "✓" : index + 1}
            </span>
            <span className="font-label text-[11px] font-semibold uppercase tracking-wide">
              {step.label}
            </span>
          </>
        );

        if (onStepClick) {
          return (
            <Button
              key={step.id}
              type="button"
              variant="ghost"
              disabled={stepNavigationDisabled || !reachable}
              onClick={() => {
                if (stepNavigationDisabled || !reachable) return;
                onStepClick(index);
                onSelectStep?.();
              }}
              aria-current={active ? "step" : undefined}
              className={cn(
                "inline-flex h-auto min-h-10 items-center gap-2 rounded-md border px-3 py-1.5 shadow-none transition-colors",
                fullWidth ? "w-full justify-start" : "",
                active
                  ? "border-primary/40 bg-primary/5 text-on-surface"
                  : "border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:border-primary/30",
                !reachable && "cursor-not-allowed opacity-50",
              )}
            >
              {content}
            </Button>
          );
        }

        return (
          <div
            key={step.id}
            className={cn(
              "inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-1.5",
              active
                ? "border-primary/40 bg-primary/5 text-on-surface"
                : "border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant",
            )}
            aria-current={active ? "step" : undefined}
          >
            {content}
          </div>
        );
      })}
    </>
  );
}

/**
 * Shared multi-step progress indicator.
 * - `variant="bar"`: compact "Step N of M" + progress bar (+ optional mobile step sheet).
 * - `variant="chips"`: horizontal step chips with optional jump navigation.
 */
export function WizardProgress({
  steps,
  currentIndex,
  maxReachableIndex,
  completedStepIds,
  onStepClick,
  stepNavigationDisabled = false,
  variant = "bar",
  enableMobileSheet = false,
  sidebarContent,
  showUpNext = false,
  className,
}: WizardProgressProps) {
  const [stepsOpen, setStepsOpen] = useState(false);
  const stepCount = steps.length;
  const current = steps[currentIndex];
  const nextLabel = steps[currentIndex + 1]?.label;
  const reachableMax = maxReachableIndex ?? stepCount - 1;

  if (variant === "chips") {
    return (
      <nav aria-label="Form steps" className={cn("space-y-2", className)}>
        <StepHeader current={current} currentIndex={currentIndex} stepCount={stepCount} />
        <div className="flex flex-wrap gap-2">
          <WizardStepChips
            steps={steps}
            currentIndex={currentIndex}
            maxReachableIndex={reachableMax}
            completedStepIds={completedStepIds}
            onStepClick={onStepClick}
            stepNavigationDisabled={stepNavigationDisabled}
          />
        </div>
      </nav>
    );
  }

  const endowedBase = 100 / stepCount;
  const progressPercent = Math.min(
    100,
    endowedBase + (currentIndex / stepCount) * (100 - endowedBase),
  );

  return (
    <nav aria-label="Form steps" className={cn("mb-6", className)}>
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1 px-1">
          <StepHeader current={current} currentIndex={currentIndex} stepCount={stepCount} />
          {showUpNext && nextLabel ? (
            <p className="truncate font-body text-xs text-on-surface-variant">
              Up next: {nextLabel}
            </p>
          ) : null}
        </div>
        {enableMobileSheet ? (
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
              <div className="mt-4 flex flex-col gap-2 px-6 pb-6">
                <WizardStepChips
                  steps={steps}
                  currentIndex={currentIndex}
                  maxReachableIndex={reachableMax}
                  completedStepIds={completedStepIds}
                  onStepClick={onStepClick}
                  stepNavigationDisabled={stepNavigationDisabled}
                  onSelectStep={() => setStepsOpen(false)}
                  fullWidth
                />
                {sidebarContent ? (
                  <div className="mt-4 border-t border-outline-variant/30 pt-4">
                    {sidebarContent}
                  </div>
                ) : null}
              </div>
            </BottomSheetContent>
          </BottomSheet>
        ) : null}
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
    </nav>
  );
}
