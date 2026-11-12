"use client";

import { CONFLICT_COPY } from "@/lib/admin/reoffer/reoffer-copy";
import { redirectToHostedReauth } from "@/lib/auth/step-up/use-step-up-coordinator";
import type { ActionResult } from "@/lib/forms/form-result";
import { notify } from "@/lib/ui/notify";
import { useStaffStepUp } from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Step = {
  /** Runs the server action. */
  run: () => Promise<ActionResult<unknown>>;
  /** "send this offer", for "To send this offer, sign in again". */
  stepUpAction: string;
  success: string;
  /** Called with the dialog still open, once the step has gone through. */
  onDone: () => void;
};

/**
 * What every dialog of a re-offer step does around its server action: busy while it runs, the
 * API's refusal kept in the dialog (with the words for a clash with another staff member), a
 * fresh sign-in when asked for, and a toast and refresh when it goes through.
 */
export function useReofferStep() {
  const router = useRouter();
  const [failure, setFailure] = useState<{ message: string; code: string | null } | null>(null);
  const [busy, startTransition] = useTransition();
  const stepUp = useStaffStepUp({ onReauthenticate: redirectToHostedReauth });

  const submit = (step: Step) => {
    setFailure(null);
    startTransition(async () => {
      const result = await step.run();
      if (result.ok) {
        step.onDone();
        notify.success(step.success);
        router.refresh();
        return;
      }
      if (stepUp.handle(result, step.stepUpAction)) {
        step.onDone();
        return;
      }
      const code = result.errorCode ?? null;
      setFailure({ message: code === "conflict" ? CONFLICT_COPY : result.error, code });
    });
  };

  return { busy, failure, clear: () => setFailure(null), submit, stepUpDialog: stepUp.dialog };
}
