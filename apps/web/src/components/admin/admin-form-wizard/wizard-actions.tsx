"use client";

import { WizardNav } from "@auction/ui/components/wizard-nav";
import type { ReactNode } from "react";

type Props = {
  isFirst: boolean;
  isLast: boolean;
  onBack: () => void;
  onNext: () => void;
  /** Shown on the last step (typically submit). */
  submitSlot?: ReactNode;
  /** When true, submit is shown alongside Continue on every step (edit flows). */
  showSubmitOnAllSteps?: boolean;
  nextLabel?: string;
  backLabel?: string;
  pending?: boolean;
};

/** Admin wizard Back/Continue/submit — thin wrapper over the shared {@link WizardNav}. */
export function WizardActions({
  isFirst,
  isLast,
  onBack,
  onNext,
  submitSlot,
  showSubmitOnAllSteps = false,
  nextLabel,
  backLabel = "Back",
  pending = false,
}: Props) {
  return (
    <WizardNav
      isFirst={isFirst}
      isLast={isLast}
      onBack={onBack}
      onNext={onNext}
      backLabel={backLabel}
      showSubmitOnAllSteps={showSubmitOnAllSteps}
      pending={pending}
      layout="end"
      {...(submitSlot ? { submitSlot } : {})}
      {...(nextLabel ? { nextStepLabel: nextLabel } : {})}
    />
  );
}
