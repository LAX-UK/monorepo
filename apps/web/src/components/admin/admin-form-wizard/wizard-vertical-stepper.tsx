"use client";

import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import type { WizardStepSpec } from "./step-indicator";

type Props = {
  steps: readonly WizardStepSpec[];
  currentIndex: number;
  onStepClick?: (index: number) => void;
  stepNavigationDisabled?: boolean;
  className?: string;
};

function StepDotRail({
  reached,
  subItems,
}: {
  reached: boolean;
  subItems?: readonly string[];
}) {
  const dotClass = reached ? "bg-secondary" : "bg-on-surface-variant/40";
  const showSubRail = subItems != null && subItems.length > 0 && reached;

  if (showSubRail) {
    return (
      <div className="flex flex-col items-center gap-4 self-stretch pt-2" aria-hidden>
        <span className={cn("size-2 shrink-0 rounded-full", dotClass)} />
        {subItems.map((item) => (
          <span key={item} className={cn("size-1 shrink-0 rounded-full", dotClass)} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center self-stretch" aria-hidden>
      <span className={cn("size-2 shrink-0 rounded-full", dotClass)} />
    </div>
  );
}

function StepDivider() {
  return (
    <div className="flex h-[38px] items-center pl-[3px]" aria-hidden>
      <div className="h-px w-[38px] bg-outline-variant/30" />
    </div>
  );
}

/**
 * Vertical wizard stepper for desktop sidebar layout.
 * Reference: Admin Dashboard `82:764` / step component `84:1446`.
 */
export function WizardVerticalStepper({
  steps,
  currentIndex,
  onStepClick,
  stepNavigationDisabled = false,
  className,
}: Props) {
  return (
    <nav aria-label="Form steps" className={cn(className)}>
      <ol className="flex flex-col gap-2">
        {steps.map((step, index) => {
          const active = index === currentIndex;
          const reached = index <= currentIndex;
          const future = index > currentIndex;
          const showSubLabels = step.subItems != null && step.subItems.length > 0 && reached;

          const copyBlock = (
            <span className="min-w-0">
              <span
                className={cn(
                  "block font-body text-base leading-6",
                  reached ? "text-on-surface" : "text-on-surface-variant",
                )}
              >
                {step.label}
              </span>
              {showSubLabels ? (
                <span className="mt-0 block">
                  {step.subItems?.map((item) => (
                    <span
                      key={item}
                      className="block font-body text-sm leading-[22px] text-on-surface-variant"
                    >
                      {item}
                    </span>
                  ))}
                </span>
              ) : step.description ? (
                <span
                  className={cn(
                    "mt-0 block font-body text-sm leading-[22px]",
                    future ? "text-on-surface-variant/50" : "text-on-surface-variant",
                  )}
                >
                  {step.description}
                </span>
              ) : null}
            </span>
          );

          const rowClass = cn(
            "flex w-full items-start gap-4 text-left transition-colors",
            onStepClick != null &&
              !stepNavigationDisabled &&
              "rounded-md hover:bg-surface-container-low/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            stepNavigationDisabled && onStepClick != null && "cursor-not-allowed opacity-60",
          );

          return (
            <li key={step.id} className="flex flex-col">
              {onStepClick ? (
                <Button
                  type="button"
                  variant="ghost"
                  className={rowClass}
                  disabled={stepNavigationDisabled}
                  aria-current={active ? "step" : undefined}
                  onClick={() => {
                    if (stepNavigationDisabled) return;
                    onStepClick(index);
                  }}
                >
                  <StepDotRail
                    reached={reached}
                    {...(step.subItems ? { subItems: step.subItems } : {})}
                  />
                  {copyBlock}
                </Button>
              ) : (
                <div className={rowClass} aria-current={active ? "step" : undefined}>
                  <StepDotRail
                    reached={reached}
                    {...(step.subItems ? { subItems: step.subItems } : {})}
                  />
                  {copyBlock}
                </div>
              )}
              {index < steps.length - 1 ? <StepDivider /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
