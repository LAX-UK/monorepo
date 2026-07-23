"use client";

import { WizardProgress } from "@auction/ui/components/wizard-progress";

import type { WizardStepSpec } from "@/lib/admin/wizard/types";

export type { WizardStepSpec };

type Props = {
  steps: readonly WizardStepSpec[];
  currentIndex: number;
  onStepClick?: (index: number) => void;
  /** When true, step chips cannot be clicked (e.g. while validating a step jump). */
  stepNavigationDisabled?: boolean;
  className?: string;
};

/** Admin wizard step chips — thin wrapper over the shared {@link WizardProgress}. */
export function WizardStepIndicator({
  steps,
  currentIndex,
  onStepClick,
  stepNavigationDisabled = false,
  className,
}: Props) {
  return (
    <WizardProgress
      steps={steps}
      currentIndex={currentIndex}
      variant="chips"
      stepNavigationDisabled={stepNavigationDisabled}
      {...(onStepClick ? { onStepClick } : {})}
      {...(className ? { className } : {})}
    />
  );
}
