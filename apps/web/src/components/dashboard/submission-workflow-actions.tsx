"use client";

import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
import {
  submitForReviewFromValuesAction,
  withdrawSubmissionFromValuesAction,
} from "@/lib/actions/submissions";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Props = {
  submissionId: string;
  canSubmit: boolean;
  canWithdraw: boolean;
};

export function SubmissionWorkflowActions({ submissionId, canSubmit, canWithdraw }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

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
          onClick={() => {
            startTransition(() => {
              void (async () => {
                const r = await submitForReviewFromValuesAction(submissionId);
                if (r.ok) {
                  notify.success("Submitted for review");
                  router.refresh();
                  return;
                }
                notify.error(r.error);
              })();
            });
          }}
        >
          Submit for review
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
          onConfirmed={() => {
            startTransition(() => {
              void (async () => {
                const r = await withdrawSubmissionFromValuesAction(submissionId);
                if (r.ok) {
                  notify.success("Withdrawn");
                  router.refresh();
                  return;
                }
                notify.error(r.error);
              })();
            });
          }}
        >
          Withdraw
        </ConfirmActionButton>
      ) : null}
    </section>
  );
}
