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
  nextLabel = "Continue",
  backLabel = "Back",
  pending = false,
}: Props) {
  return (
    <div className="flex flex-col justify-end gap-3 sm:flex-row sm:items-center">
      {!isFirst ? (
        <Button type="button" variant="outline" disabled={pending} onClick={onBack}>
          {backLabel}
        </Button>
      ) : (
        <span />
      )}
      {isLast ? (
        (submitSlot ?? null)
      ) : (
        <Button type="button" disabled={pending} onClick={onNext}>
          {nextLabel}
        </Button>
      )}
    </div>
  );
}
