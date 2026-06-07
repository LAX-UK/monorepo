"use client";

import type { AutosaveStatus } from "@/lib/forms/submission/use-submission-wizard-controller";
import { wizardAutosaveLabel } from "@/lib/forms/submission/wizard-autosave-label";
import { SUBMISSION_AUTOSAVE_EXPLAINER } from "@/lib/marketing/sell-flow-copy";
import { WizardContextStrip } from "@auction/ui/components/wizard-context-strip";

type Props = {
  autosaveStatus: AutosaveStatus;
  lastSavedAt: Date | null;
  showAutosave: boolean;
};

export function SubmissionDraftContextStrip({ autosaveStatus, lastSavedAt, showAutosave }: Props) {
  const statusText = showAutosave ? wizardAutosaveLabel(autosaveStatus, lastSavedAt) : "";

  return (
    <WizardContextStrip
      explainer={SUBMISSION_AUTOSAVE_EXPLAINER}
      statusTone={autosaveStatus === "error" ? "error" : "default"}
      {...(statusText ? { statusText } : {})}
    />
  );
}
