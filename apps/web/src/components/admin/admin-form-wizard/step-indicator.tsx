"use client";

import type { WizardStepSpec } from "@/lib/admin/wizard/types";
import { StepIndicator } from "@auction/staff-ui";

export type { WizardStepSpec };

type Props = {
  steps: readonly WizardStepSpec[];
  currentIndex: number;
  onStepClick?: (index: number) => void;
  /** When true, steps cannot be clicked (e.g. while validating a step jump). */
  stepNavigationDisabled?: boolean;
  className?: string;
};

/** The wizard's steps above the form, on the kit step indicator. */
export function WizardStepIndicator({
  steps,
  currentIndex,
  onStepClick,
  stepNavigationDisabled = false,
  className,
}: Props) {
  return (
    <StepIndicator
      steps={steps}
      currentIndex={currentIndex}
      disabled={stepNavigationDisabled}
      label="Form steps"
      {...(onStepClick ? { onStepClick } : {})}
      {...(className ? { className } : {})}
    />
  );
}
