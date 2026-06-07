"use client";

import type { AutosaveStatus } from "@/lib/forms/submission/use-submission-wizard-controller";
import { wizardAutosaveLabel } from "@/lib/forms/submission/wizard-autosave-label";
import { cn } from "@auction/ui";
import { WizardNav } from "@auction/ui/components/wizard-nav";

type Props = {
  isLastStep: boolean;
  isSubmitting: boolean;
  autosaveStatus: AutosaveStatus;
  lastSavedAt: Date | null;
  showAutosave: boolean;
  nextStepLabel?: string;
  onBack: () => void;
  onNext: () => void;
  canGoBack: boolean;
};

export function WizardFooter({
  isLastStep,
  isSubmitting,
  autosaveStatus,
  lastSavedAt,
  showAutosave,
  nextStepLabel,
  onBack,
  onNext,
  canGoBack,
}: Props) {
  const statusText = showAutosave ? wizardAutosaveLabel(autosaveStatus, lastSavedAt) : "";

  if (isLastStep) return null;

  return (
    <WizardNav
      isFirst={!canGoBack}
      isLast={false}
      onBack={onBack}
      onNext={onNext}
      pending={isSubmitting}
      layout="stretch"
      sticky
      {...(nextStepLabel ? { nextStepLabel } : {})}
      statusSlot={
        statusText ? (
          <p
            className={cn(
              "min-h-5 font-label text-[10px] uppercase tracking-wider",
              autosaveStatus === "error" ? "text-live-red" : "text-on-surface-variant",
            )}
            aria-live="polite"
          >
            {statusText}
          </p>
        ) : null
      }
    />
  );
}
