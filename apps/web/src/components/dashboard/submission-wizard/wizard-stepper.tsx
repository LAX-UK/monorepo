"use client";

import { WIZARD_STEPS } from "@/lib/forms/submission/step-validation";
import { WizardProgress, type WizardProgressStep } from "@auction/ui/components/wizard-progress";

type Props = {
  activeIndex: number;
  maxReachableIndex: number;
  onStepClick: (index: number) => void;
  /**
   * Steps a flow adds after the form's own ("Who is selling?"), so the whole flow has one
   * progress bar.
   */
  trailingSteps?: readonly WizardProgressStep[];
};

export function WizardStepper({
  activeIndex,
  maxReachableIndex,
  onStepClick,
  trailingSteps = [],
}: Props) {
  return (
    <WizardProgress
      steps={[...WIZARD_STEPS.map((s) => ({ id: s.id, label: s.label })), ...trailingSteps]}
      currentIndex={activeIndex}
      maxReachableIndex={maxReachableIndex}
      onStepClick={onStepClick}
      variant="bar"
      enableMobileSheet
      showUpNext
    />
  );
}
