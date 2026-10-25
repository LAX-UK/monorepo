"use client";

import { StepIndicator } from "@auction/staff-ui";
import type { WizardStepSpec } from "./step-indicator";

type Props = {
  steps: readonly WizardStepSpec[];
  currentIndex: number;
  onStepClick?: (index: number) => void;
  stepNavigationDisabled?: boolean;
  className?: string;
};

/** The wizard's steps: a row above the form on small screens, a column beside it from lg. */
export function WizardVerticalStepper({
  steps,
  currentIndex,
  onStepClick,
  stepNavigationDisabled = false,
  className,
}: Props) {
  return (
    <StepIndicator
      steps={steps.map((step) => ({
        id: step.id,
        label: step.label,
        ...(step.subItems?.length
          ? { description: step.subItems.join(", ") }
          : step.description
            ? { description: step.description }
            : {}),
      }))}
      currentIndex={currentIndex}
      orientation="responsive"
      disabled={stepNavigationDisabled}
      label="Form steps"
      {...(onStepClick ? { onStepClick } : {})}
      {...(className ? { className } : {})}
    />
  );
}
