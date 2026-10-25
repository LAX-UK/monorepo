"use client";

import { StaffButton } from "@auction/staff-ui";
import { ArrowLeft, ArrowRight } from "lucide-react";
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

/** Back, Continue (naming the next step) and, on the last step, the submit button. */
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
    <>
      {isFirst ? null : (
        <StaffButton
          type="button"
          variant="secondary"
          icon={<ArrowLeft aria-hidden />}
          disabled={pending}
          onClick={onBack}
        >
          {backLabel}
        </StaffButton>
      )}
      {isLast ? null : (
        <StaffButton
          type="button"
          variant={showSubmitOnAllSteps ? "secondary" : "primary"}
          disabled={pending}
          onClick={onNext}
        >
          {nextLabel ? `Continue to ${nextLabel.toLowerCase()}` : "Continue"}
          <ArrowRight aria-hidden className="size-4" />
        </StaffButton>
      )}
      {isLast || showSubmitOnAllSteps ? submitSlot : null}
    </>
  );
}
