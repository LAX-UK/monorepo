"use client";

import { Button } from "@auction/ui/components/button";
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

export function WizardActions({
  isFirst,
  isLast,
  onBack,
  onNext,
  submitSlot,
  showSubmitOnAllSteps = false,
  nextLabel = "Continue",
  backLabel = "Back",
  pending = false,
}: Props) {
  const showSubmit = isLast || showSubmitOnAllSteps;
  const showNext = !isLast;

  return (
    <div className="flex flex-col justify-end gap-3 sm:flex-row sm:items-center">
      {!isFirst ? (
        <Button type="button" variant="outline" disabled={pending} onClick={onBack}>
          {backLabel}
        </Button>
      ) : (
        <span />
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {showNext ? (
          <Button type="button" disabled={pending} onClick={onNext}>
            {nextLabel}
          </Button>
        ) : null}
        {showSubmit ? (submitSlot ?? null) : null}
      </div>
    </div>
  );
}
