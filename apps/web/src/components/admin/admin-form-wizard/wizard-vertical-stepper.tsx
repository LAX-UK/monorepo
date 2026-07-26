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

type StepState = "active" | "completed" | "future";

function getStepState(index: number, currentIndex: number): StepState {
  if (index === currentIndex) return "active";
  if (index < currentIndex) return "completed";
  return "future";
}

function StepDotRail({
  state,
  subItems,
}: {
  state: StepState;
  subItems?: readonly string[];
}) {
  const primaryDotClass = state === "future" ? "bg-on-surface-variant/40" : "bg-info";
  const subDotClass = state === "future" ? "bg-on-surface-variant/40" : "bg-info";
  const hasSubItems = subItems != null && subItems.length > 0;

  if (hasSubItems) {
    return (
      <div className="flex w-2 shrink-0 flex-col items-center gap-4 self-stretch pt-2" aria-hidden>
        <span className={cn("size-2 shrink-0 rounded-full", primaryDotClass)} />
        {subItems.map((item) => (
          <span key={item} className={cn("size-1 shrink-0 rounded-full", subDotClass)} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex w-2 shrink-0 items-center self-stretch pt-2" aria-hidden>
      <span className={cn("size-2 shrink-0 rounded-full", primaryDotClass)} />
    </div>
  );
}

function StepConnector({ reached }: { reached: boolean }) {
  return (
    <div
      className="flex h-[38px] w-2 shrink-0 justify-center"
      aria-hidden
      data-testid="wizard-step-connector"
    >
      <div className={cn("h-full w-px", reached ? "bg-info/35" : "bg-outline-variant/30")} />
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
      <ol className="flex flex-col">
        {steps.map((step, index) => {
          const state = getStepState(index, currentIndex);
          const active = state === "active";
          const future = state === "future";
          const hasSubItems = step.subItems != null && step.subItems.length > 0;

          const copyBlock = (
            <span className="min-w-0">
              <span
                className={cn(
                  "block font-body text-base leading-6",
                  active && "font-medium text-on-surface",
                  state === "completed" && "text-on-surface",
                  future && "font-medium text-on-surface-variant",
                )}
              >
                {step.label}
              </span>
              {hasSubItems ? (
                <span className="mt-0 block">
                  {step.subItems?.map((item) => (
                    <span
                      key={item}
                      className={cn(
                        "block font-body text-sm leading-[22px]",
                        future ? "text-on-surface-variant" : "text-on-surface-variant",
                      )}
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

          const buttonClass = cn(
            rowClass,
            "h-auto min-h-0 justify-start px-0 py-0 font-normal hover:bg-transparent",
            onStepClick != null && !stepNavigationDisabled && "hover:bg-surface-container-low/60",
          );

          const stepRow = (
            <div className="flex items-start gap-4">
              <StepDotRail state={state} {...(step.subItems ? { subItems: step.subItems } : {})} />
              {copyBlock}
            </div>
          );

          return (
            <li key={step.id} className="flex flex-col">
              {onStepClick ? (
                <Button
                  type="button"
                  variant="ghost"
                  className={buttonClass}
                  disabled={stepNavigationDisabled}
                  aria-current={active ? "step" : undefined}
                  onClick={() => {
                    if (stepNavigationDisabled) return;
                    onStepClick(index);
                  }}
                >
                  {stepRow}
                </Button>
              ) : (
                <div className={rowClass} aria-current={active ? "step" : undefined}>
                  {stepRow}
                </div>
              )}
              {index < steps.length - 1 ? (
                <div className="flex items-start gap-4">
                  <StepConnector reached={index < currentIndex} />
                  <span className="min-w-0" aria-hidden />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
