"use client";

import type { AutosaveStatus } from "@/lib/forms/submission/use-submission-wizard-controller";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";

type Props = {
  isLastStep: boolean;
  isSubmitting: boolean;
  autosaveStatus: AutosaveStatus;
  lastSavedAt: Date | null;
  showAutosave: boolean;
  onBack: () => void;
  onNext: () => void;
  canGoBack: boolean;
};

function autosaveLabel(status: AutosaveStatus, lastSavedAt: Date | null): string {
  if (status === "saving") return "Saving…";
  if (status === "dirty") return "Unsaved changes";
  if (status === "error") return "Could not save";
  if (status === "saved" && lastSavedAt) {
    return `Saved · ${lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  return "";
}

export function WizardFooter({
  isLastStep,
  isSubmitting,
  autosaveStatus,
  lastSavedAt,
  showAutosave,
  onBack,
  onNext,
  canGoBack,
}: Props) {
  const statusText = showAutosave ? autosaveLabel(autosaveStatus, lastSavedAt) : "";

  if (isLastStep) return null;

  return (
    <div
      className={cn(
        "sticky z-50 -mx-4 border-t border-border-hairline bg-surface-container-lowest/95 px-4 pt-4 backdrop-blur-sm sm:-mx-0 sm:rounded-xl sm:border sm:shadow-md",
        "pb-[max(1rem,env(safe-area-inset-bottom))]",
      )}
      style={{ bottom: "env(keyboard-inset-height, 0px)" }}
    >
      {statusText ? (
        <p
          className={cn(
            "mb-3 min-h-5 font-label text-[10px] uppercase tracking-wider",
            autosaveStatus === "error" ? "text-live-red" : "text-on-surface-variant",
          )}
          aria-live="polite"
        >
          {statusText}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        {canGoBack ? (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="min-h-12 shrink-0 px-4"
            disabled={isSubmitting}
            onClick={onBack}
            data-testid="wizard-back"
          >
            Back
          </Button>
        ) : null}
        <Button
          type="button"
          variant="cta"
          size="lg"
          className="min-h-12 flex-1"
          disabled={isSubmitting}
          onClick={onNext}
          data-testid="wizard-next"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
