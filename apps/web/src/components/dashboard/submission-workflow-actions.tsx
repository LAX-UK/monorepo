"use client";

import { ConfirmActionButton } from "@/components/dashboard/confirm-action-button";
import {
  submitForReviewFromValuesAction,
  withdrawSubmissionFromValuesAction,
} from "@/lib/actions/submissions";
import { SUBMISSION_SUBMIT_LABEL } from "@/lib/marketing/sell-flow-copy";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { DELETE_DRAFT_COPY } from "@/lib/seller/delete-draft";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/lax/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DeleteDraftDialog } from "./seller/delete-draft-dialog";

type Props = {
  submissionId: string;
  canSubmit: boolean;
  canWithdraw: boolean;
  /** A draft this person may delete (GAP-53). */
  canDeleteDraft?: boolean;
};

export function SubmissionWorkflowActions({
  submissionId,
  canSubmit,
  canWithdraw,
  canDeleteDraft = false,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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

  if (!canSubmit && !canWithdraw && !canDeleteDraft) {
    return null;
  }

  return (
    <section
      aria-label="Consignment actions"
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
          variant="secondary"
          confirmTitle="Withdraw this work"
          confirmBody="We stop reviewing it. You can send it again later if you change your mind."
          confirmLabel="Withdraw"
          onConfirmed={() =>
            void runAction(() => withdrawSubmissionFromValuesAction(submissionId), "Withdrawn")
          }
        >
          Withdraw
        </ConfirmActionButton>
      ) : null}
      {canDeleteDraft ? (
        <>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => setDeleteOpen(true)}
          >
            {DELETE_DRAFT_COPY.action}
          </Button>
          <DeleteDraftDialog
            submissionId={submissionId}
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            // The draft is gone: back to the list, which no longer shows it.
            onDeleted={() => router.push(CLIENT_ROUTES.consignments)}
          />
        </>
      ) : null}
    </section>
  );
}
