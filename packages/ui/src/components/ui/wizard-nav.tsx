"use client";

import type { ReactNode } from "react";
import { cn } from "../../lib/utils.js";
import { wizardContinueLabel } from "../../lib/wizard-copy.js";
import { Button } from "./button.js";

export type WizardNavLayout = "stretch" | "end";

export type WizardNavProps = {
  isFirst: boolean;
  isLast: boolean;
  onBack: () => void;
  onNext: () => void;
  /** When set, the Continue button reads "Continue to {nextStepLabel}". */
  nextStepLabel?: string;
  backLabel?: string;
  /** Shown on the last step (and on every step when `showSubmitOnAllSteps`). */
  submitSlot?: ReactNode;
  showSubmitOnAllSteps?: boolean;
  /** Status / autosave line rendered above the buttons. */
  statusSlot?: ReactNode;
  pending?: boolean;
  /**
   * "stretch": full-width sticky footer (Continue grows) — seller wizards.
   * "end": right-aligned inline actions — admin forms inside StickySaveBar.
   */
  layout?: WizardNavLayout;
  /** Apply the sticky safe-area footer wrapper (seller wizards). */
  sticky?: boolean;
  className?: string;
};

/** Shared Back / Continue / submit navigation for multi-step forms. */
export function WizardNav({
  isFirst,
  isLast,
  onBack,
  onNext,
  nextStepLabel,
  backLabel = "Back",
  submitSlot,
  showSubmitOnAllSteps = false,
  statusSlot,
  pending = false,
  layout = "stretch",
  sticky = false,
  className,
}: WizardNavProps) {
  const showNext = !isLast;
  const showSubmit = isLast || showSubmitOnAllSteps;
  const nextLabel = wizardContinueLabel(nextStepLabel);

  const buttons =
    layout === "stretch" ? (
      <div className="flex items-center gap-3">
        {!isFirst ? (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="min-h-12 shrink-0 px-4"
            disabled={pending}
            onClick={onBack}
            data-testid="wizard-back"
          >
            {backLabel}
          </Button>
        ) : null}
        {showNext ? (
          <Button
            type="button"
            variant="cta"
            size="lg"
            className="min-h-12 flex-1"
            disabled={pending}
            onClick={onNext}
            data-testid="wizard-next"
          >
            {nextLabel}
          </Button>
        ) : null}
        {showSubmit ? <div className="flex-1">{submitSlot}</div> : null}
      </div>
    ) : (
      <div className="flex flex-col justify-end gap-3 sm:flex-row sm:items-center">
        {!isFirst ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onBack}
            data-testid="wizard-back"
          >
            {backLabel}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {showNext ? (
            <Button type="button" disabled={pending} onClick={onNext} data-testid="wizard-next">
              {nextLabel}
            </Button>
          ) : null}
          {showSubmit ? (submitSlot ?? null) : null}
        </div>
      </div>
    );

  if (!sticky) {
    return (
      <div className={className}>
        {statusSlot ? <div className="mb-3">{statusSlot}</div> : null}
        {buttons}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "sticky z-50 -mx-4 border-t border-border-hairline bg-surface-container-lowest/95 px-4 pt-4 backdrop-blur-sm sm:-mx-0 sm:rounded-xl sm:border sm:shadow-md",
        "pb-[max(1rem,env(safe-area-inset-bottom))]",
        className,
      )}
      style={{ bottom: "env(keyboard-inset-height, 0px)" }}
    >
      {statusSlot ? <div className="mb-3">{statusSlot}</div> : null}
      {buttons}
    </div>
  );
}
