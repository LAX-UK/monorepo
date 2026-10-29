"use client";

import { trackWizardSubmit } from "@/lib/analytics/sell-funnel";
import { notify } from "@/lib/ui/notify";
import { useEffect } from "react";

/**
 * Confirms a submission that has just been sent, on the page the send redirected to, then takes
 * `?submitted=1` off the address so a reload does not say it again.
 */
export function SubmissionSubmittedNotice({ submissionId }: { submissionId: string }) {
  useEffect(() => {
    trackWizardSubmit(submissionId);
    notify.success("Submitted for review");
    const url = new URL(window.location.href);
    url.searchParams.delete("submitted");
    window.history.replaceState(window.history.state, "", url);
  }, [submissionId]);
  return null;
}
