"use client";

import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

export type WizardStepSpec = {
  id: string;
  label: string;
  /** Optional per-step time hint, e.g. 1 for "1 min" */
  estimatedMinutes?: number;
};

type Props = {
  steps: readonly WizardStepSpec[];
  currentIndex: number;
  onStepClick?: (index: number) => void;
  /** When true, step chips cannot be clicked (e.g. while validating a step jump). */
  stepNavigationDisabled?: boolean;
  className?: string;
};

export function WizardStepIndicator({
  steps,
  currentIndex,
  onStepClick,
  stepNavigationDisabled = false,
  className,
}: Props) {
  const stepCount = steps.length;
  const current = steps[currentIndex];

  return (
    <nav aria-label="Form steps" className={cn("space-y-2", className)}>
      <p className="font-body text-xs text-on-surface-variant">
        Step {currentIndex + 1} of {stepCount}
        {current?.label ? ` — ${current.label}` : ""}
        {current?.estimatedMinutes != null ? ` · ~${current.estimatedMinutes} min` : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        {steps.map((step, index) => {
          const active = index === currentIndex;
          const done = index < currentIndex;
          const content: ReactNode = (
            <>
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full font-label text-[10px]",
                  active && "bg-primary text-on-primary",
                  done && !active && "bg-success/15 text-success",
                  !active && !done && "bg-surface-container-high text-on-surface-variant",
                )}
                aria-hidden
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
              </span>
              <span className="font-label text-[11px] uppercase tracking-wide">{step.label}</span>
            </>
          );
          if (onStepClick) {
            return (
              <Button
                key={step.id}
                type="button"
                variant="ghost"
                disabled={stepNavigationDisabled}
                onClick={() => {
                  if (stepNavigationDisabled) return;
                  onStepClick(index);
                }}
                className={cn(
                  "inline-flex h-auto min-h-10 items-center gap-2 rounded-md border px-3 py-1.5 shadow-none transition-colors",
                  active
                    ? "border-primary/40 bg-primary/5 text-on-surface"
                    : "border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:border-primary/30",
                )}
                aria-current={active ? "step" : undefined}
              >
                {content}
              </Button>
            );
          }
          return (
            <StepChip key={step.id} active={active}>
              {content}
            </StepChip>
          );
        })}
      </div>
    </nav>
  );
}

function StepChip({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-1.5",
        active
          ? "border-primary/40 bg-primary/5 text-on-surface"
          : "border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant",
      )}
      aria-current={active ? "step" : undefined}
    >
      {children}
    </div>
  );
}
