"use client";

import { useAdminMutation } from "@/components/use-admin-mutation";
import type { AdminMutationResult } from "@/server/application/admin-mutation-result";
import { Notice, StepUpDialog } from "@auction/staff-ui";
import { useCallback, useState } from "react";

/**
 * An admin action run from a dialog or a panel. Success is a passing toast and a data refresh.
 * A request that needs a recent sign-in opens the kit's "Confirm it's you" dialog, which sends
 * the person to sign in again and back to this page; any other failure stays in `error`, a
 * danger notice to place in the dialog, until the next attempt.
 */
export function useAdminAction() {
  const mutation = useAdminMutation();
  const [stepUp, setStepUp] = useState<{ action?: string } | null>(null);
  const [leaving, setLeaving] = useState(false);

  const run = useCallback(
    async (
      action: () => Promise<AdminMutationResult<unknown>>,
      successMessage: string,
      /** What needs a fresh sign-in, as a verb phrase: "mark £85.00 paid". */
      stepUpAction?: string,
    ) => {
      let needsStepUp = false;
      const ok = await mutation.run(async () => {
        const result = await action();
        needsStepUp = !result.ok && result.kind === "step_up_required";
        return result;
      }, successMessage);
      if (needsStepUp) setStepUp(stepUpAction ? { action: stepUpAction } : {});
      return ok;
    },
    [mutation.run],
  );

  const error =
    mutation.message && !mutation.stepUpRequired ? (
      <Notice tone="danger" alert title={mutation.message} />
    ) : null;

  const stepUpDialog = (
    <StepUpDialog
      open={stepUp !== null}
      onOpenChange={(open) => {
        if (!open) setStepUp(null);
      }}
      {...(stepUp?.action ? { action: stepUp.action } : {})}
      reauthenticating={leaving}
      onReauthenticate={() => {
        setLeaving(true);
        window.location.assign(mutation.stepUpHref);
      }}
    />
  );

  return {
    run,
    pending: mutation.pending,
    idempotencyKey: mutation.idempotencyKey,
    error,
    stepUpDialog,
  };
}

export type AdminAction = ReturnType<typeof useAdminAction>;
