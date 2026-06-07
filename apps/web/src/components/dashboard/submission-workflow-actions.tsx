"use client";

import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
import {
  submitForReviewFromValuesAction,
  withdrawSubmissionFromValuesAction,
} from "@/lib/actions/submissions";
import { SUBMISSION_SUBMIT_LABEL } from "@/lib/marketing/sell-flow-copy";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  submissionId: string;
  canSubmit: boolean;
  canWithdraw: boolean;
};

export function SubmissionWorkflowActions({ submissionId, canSubmit, canWithdraw }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function runAction(work: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    if (pending) return;
    setPending(true);
    try {
      const r = await work();
      if (r.ok) {
        notify.success(success);
        router.refresh();
        return;
      }
      notify.error(r.error ?? "Action failed");
    } finally {
      setPending(false);
    }
  }

  if (!canSubmit && !canWithdraw) {
    return null;
  }

  return (
    <section
      aria-label="Submission actions"
      className="flex flex-wrap gap-3 rounded-xl border border-border-hairline bg-surface-container-lowest p-4 shadow-sm"
    >
      {canSubmit ? (
        <Button
          type="button"
          disabled={pending}
          aria-busy={pending}
          onClick={() =>
            void runAction(
              () => submitForReviewFromValuesAction(submissionId),
              "Submitted for review",
            )
          }
        >
          {SUBMISSION_SUBMIT_LABEL}
        </Button>
      ) : null}
      {canWithdraw ? (
        <ConfirmActionButton
          type="button"
          disabled={pending}
          variant="secondaryOutline"
          confirmTitle="Withdraw submission"
          confirmBody="Withdraw this submission? You can start a new submission later if needed."
          confirmLabel="Withdraw"
          onConfirmed={() =>
            void runAction(() => withdrawSubmissionFromValuesAction(submissionId), "Withdrawn")
          }
        >
          Withdraw
        </ConfirmActionButton>
      ) : null}
    </section>
  );
}
