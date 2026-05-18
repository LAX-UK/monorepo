"use client";

import type { AutosaveStatus } from "@/lib/forms/submission/use-submission-wizard-controller";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";

type Props = {
  stepIndex: number;
  isLastStep: boolean;
  isSubmitting: boolean;
  autosaveStatus: AutosaveStatus;
  lastSavedAt: Date | null;
  showAutosave: boolean;
  onBack: () => void;
  onNext: () => void;
  onSaveAndLeave: () => void;
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
  stepIndex: _stepIndex,
  isLastStep,
  isSubmitting,
  autosaveStatus,
  lastSavedAt,
  showAutosave,
  onBack,
  onNext,
  onSaveAndLeave,
  canGoBack,
}: Props) {
  const statusText = showAutosave ? autosaveLabel(autosaveStatus, lastSavedAt) : "";

  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 -mx-4 border-t border-border-hairline bg-surface-container-lowest/95 px-4 py-4 backdrop-blur-sm sm:-mx-0 sm:rounded-xl sm:border sm:shadow-md",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p
          className={cn(
            "min-h-5 font-label text-[10px] uppercase tracking-wider",
            autosaveStatus === "error" ? "text-live-red" : "text-on-surface-variant",
          )}
          aria-live="polite"
        >
          {statusText || "\u00a0"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {canGoBack ? (
            <Button type="button" variant="ghost" disabled={isSubmitting} onClick={onBack}>
              Back
            </Button>
          ) : null}
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={onSaveAndLeave}>
            Save and continue later
          </Button>
          {!isLastStep ? (
            <Button type="button" variant="cta" disabled={isSubmitting} onClick={onNext}>
              Next
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
