"use client";

import { trackWizardSubmit } from "@/lib/analytics/sell-funnel";
import { useEffect } from "react";

/** Records that a work was sent, once, when the confirmation page opens. */
export function SubmissionSentTracker({ submissionId }: { submissionId: string }) {
  useEffect(() => {
    trackWizardSubmit(submissionId);
  }, [submissionId]);
  return null;
}
