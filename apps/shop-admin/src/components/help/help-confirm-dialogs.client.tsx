"use client";

import { useAdminAction } from "@/components/use-admin-action.client";
import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import {
  deleteHelpArticle,
  deleteHelpCategory,
  reorderHelpArticles,
  reorderHelpCategories,
  setHelpArticlePublication,
  setHelpCategoryPublication,
} from "@/server/application/admin-help-actions.server";
import { movedOrder } from "@/server/domain/help-list.vm";
import { ConfirmActionDialog, toast } from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type HelpSubject = {
  kind: "question" | "category";
  id: string;
  title: string;
};

const noun = (kind: HelpSubject["kind"]) => (kind === "question" ? "question" : "category");

function publicationCopy(subject: HelpSubject, publish: boolean): string {
  if (subject.kind === "question") {
    return publish
      ? "The question and its answer appear in the Help centre on lax.art straight away, while its category is published."
      : "The question stops showing in the Help centre on lax.art. You can publish it again later.";
  }
  return publish
    ? "The category and its published questions appear in the Help centre on lax.art straight away."
    : "The category and all of its questions stop showing in the Help centre on lax.art. You can publish it again later.";
}

/** Publish or unpublish a question or a category, saying what changes on lax.art. */
export function HelpPublicationDialog({
  subject,
  publish,
  onClose,
}: {
  subject: HelpSubject;
  publish: boolean;
  onClose: () => void;
}) {
  const action = useAdminAction();
  const label = noun(subject.kind);
  return (
    <>
      <ConfirmActionDialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={`${publish ? "Publish" : "Unpublish"} “${subject.title}”?`}
        description={publicationCopy(subject, publish)}
        confirmLabel={`${publish ? "Publish" : "Unpublish"} ${label}`}
        loading={action.pending}
        onConfirm={async () => {
          const ok = await action.run(
            () =>
              subject.kind === "question"
                ? setHelpArticlePublication({
                    id: subject.id,
                    published: publish,
                    idempotencyKey: action.idempotencyKey,
                  })
                : setHelpCategoryPublication({
                    id: subject.id,
                    published: publish,
                    idempotencyKey: action.idempotencyKey,
                  }),
            publish ? `Published “${subject.title}” on lax.art` : `Unpublished “${subject.title}”`,
            `${publish ? "publish" : "unpublish"} this ${label}`,
          );
          if (ok) onClose();
        }}
      >
        {action.error}
      </ConfirmActionDialog>
      {action.stepUpDialog}
    </>
  );
}

/** Delete a question, or an empty category. Neither can be restored. */
export function HelpDeleteDialog({
  subject,
  onClose,
  onDeleted,
}: {
  subject: HelpSubject;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const action = useAdminAction();
  const label = noun(subject.kind);
  return (
    <>
      <ConfirmActionDialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={`Delete “${subject.title}”?`}
        description={
          subject.kind === "question"
            ? "The question and its answer are removed from lax.art and cannot be restored. Unpublish it instead if you may want it back."
            : "The category is removed and cannot be restored. It has no questions, so nothing else changes on lax.art."
        }
        confirmLabel={`Delete ${label}`}
        tone="danger"
        loading={action.pending}
        onConfirm={async () => {
          const ok = await action.run(
            () =>
              subject.kind === "question"
                ? deleteHelpArticle({ id: subject.id, idempotencyKey: action.idempotencyKey })
                : deleteHelpCategory({ id: subject.id, idempotencyKey: action.idempotencyKey }),
            `Deleted “${subject.title}”`,
            `delete this ${label}`,
          );
          if (ok) {
            onDeleted?.();
            onClose();
          }
        }}
      >
        {action.error}
      </ConfirmActionDialog>
      {action.stepUpDialog}
    </>
  );
}

/**
 * Moves one row a place up or down in the order lax.art shows. The whole new order is sent, and a
 * refusal is a toast, because a move has no dialog to hold the message.
 */
export function useHelpReorder(input: {
  ids: readonly string[];
  /** The category whose questions are being ordered; omit to order the categories. */
  categoryId?: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const move = async (id: string, direction: "up" | "down") => {
    const order = movedOrder(input.ids, id, direction);
    if (!order || pending) return;
    setPending(true);
    const idempotencyKey = crypto.randomUUID();
    const result = await (input.categoryId
      ? reorderHelpArticles({ categoryId: input.categoryId, ids: order, idempotencyKey })
      : reorderHelpCategories({ ids: order, idempotencyKey })
    ).catch(() => ({ ok: false, kind: "failed", message: "Action failed. Try again." }) as const);
    setPending(false);
    if (!result.ok) {
      toast.error(adminMutationErrorMessage(result));
      return;
    }
    toast.success(`Moved ${direction}`);
    router.refresh();
  };
  return { move, pending };
}
