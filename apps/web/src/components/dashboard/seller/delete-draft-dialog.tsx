"use client";

import { deleteSubmissionDraftAction } from "@/lib/actions/submissions";
import { DELETE_DRAFT_COPY } from "@/lib/seller/delete-draft";
import { notify } from "@/lib/ui/notify";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import { useTransition } from "react";

type Props = {
  submissionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** After the draft is deleted: refresh the list, or leave the draft's page. */
  onDeleted: () => void;
  /** The server action; injectable for tests. */
  deleteDraft?: typeof deleteSubmissionDraftAction;
};

/**
 * "Delete this draft?" (GAP-53, docs/design/decision-pack-2026-11-17.md section 5), from the
 * draft's row menu and the draft's page. Deleting is the destructive confirm; once done, the toast
 * says "Draft deleted". A refusal (the draft was sent meanwhile, or the person may not) keeps the
 * dialog open and says why in the API's words.
 */
export function DeleteDraftDialog({
  submissionId,
  open,
  onOpenChange,
  onDeleted,
  deleteDraft = deleteSubmissionDraftAction,
}: Props) {
  const [pending, startTransition] = useTransition();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
      title={DELETE_DRAFT_COPY.confirmTitle}
      body={DELETE_DRAFT_COPY.confirmBody}
      confirmLabel={DELETE_DRAFT_COPY.confirmLabel}
      cancelLabel={DELETE_DRAFT_COPY.cancel}
      tone="danger"
      loading={pending}
      loadingLabel={DELETE_DRAFT_COPY.deleting}
      onConfirm={() => {
        startTransition(async () => {
          const result = await deleteDraft(submissionId);
          if (!result.ok) {
            notify.error(result.error || DELETE_DRAFT_COPY.failed);
            return;
          }
          onOpenChange(false);
          notify.success(DELETE_DRAFT_COPY.deleted);
          onDeleted();
        });
      }}
    />
  );
}
