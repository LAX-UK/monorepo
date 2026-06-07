"use client";

import { WIZARD_STEPS } from "@/lib/forms/submission/step-validation";
import { WizardProgress } from "@auction/ui/components/wizard-progress";

type Props = {
  activeIndex: number;
  maxReachableIndex: number;
  onStepClick: (index: number) => void;
  onNext?: () => void;
  onPrev?: () => void;
  canGoPrev?: boolean;
  canGoNext?: boolean;
};

export function WizardStepper({ activeIndex, maxReachableIndex, onStepClick }: Props) {
  return (
    <WizardProgress
      steps={WIZARD_STEPS.map((s) => ({ id: s.id, label: s.label }))}
      currentIndex={activeIndex}
      maxReachableIndex={maxReachableIndex}
      onStepClick={onStepClick}
      variant="bar"
      enableMobileSheet
      showUpNext
    />
  );
}
