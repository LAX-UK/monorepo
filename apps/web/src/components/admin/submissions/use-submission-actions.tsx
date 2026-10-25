"use client";

import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import {
  adminAcceptSubmissionResultAction,
  adminAssignSubmissionResultAction,
  adminRejectSubmissionResultAction,
  adminStartSubmissionReviewResultAction,
} from "@/lib/actions/admin-submissions";
import { notify } from "@/lib/ui/notify";
import type { OverflowAction } from "@auction/staff-ui";
import type { ItemSubmissionStatus } from "@auction/types";
import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

/** What the submission actions need to know, from a list row or the review page. */
export type SubmissionActionTarget = {
  id: string;
  title: string;
  status: ItemSubmissionStatus;
  /** Required details are missing, so it cannot be accepted yet. */
  blocksAccept: boolean;
  assignedToMe: boolean;
  decisionHref: string;
};

/** The shortest rejection reason accepted; it is sent to the seller. */
export const SUBMISSION_REJECT_REASON_MIN = 10;

/**
 * A submission's review actions, the same from a row's `…` menu and the record panel: start the
 * review, accept for cataloguing, reject with a reason for the seller, open the decision page to
 * create the lot, and take or hand back the review. Accepting and rejecting are confirmed through
 * the kit dialog; assigning is reversible and happens at once.
 */
export function useSubmissionActions({ currentUserId }: { currentUserId: string }) {
  const router = useRouter();
  const confirm = useStaffConfirm();
  const { ask } = confirm;
  const [, startTransition] = useTransition();

  const run = useCallback(
    (task: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) => {
      startTransition(async () => {
        const result = await task();
        if (result.ok) {
          notify.success(success);
          router.refresh();
        } else {
          notify.error(result.error);
        }
      });
    },
    [router],
  );

  const accept = useCallback(
    (submission: SubmissionActionTarget) =>
      ask({
        title: `Accept ${submission.title} for cataloguing?`,
        description:
          "The seller is told it was accepted. Create its draft lot from the decision page once the artist is confirmed.",
        confirmLabel: "Accept submission",
        run: () => adminAcceptSubmissionResultAction(submission.id, {}),
        success: `${submission.title} accepted`,
      }),
    [ask],
  );

  const reject = useCallback(
    (submission: SubmissionActionTarget) =>
      ask({
        title: `Reject ${submission.title}?`,
        description: "The seller is emailed your reason. A rejected submission cannot be reopened.",
        confirmLabel: "Reject submission",
        tone: "danger",
        reason: {
          label: "Reason for the seller",
          description: "Sent to the seller as written.",
          minLength: SUBMISSION_REJECT_REASON_MIN,
          maxLength: 2000,
        },
        run: ({ reason }) =>
          adminRejectSubmissionResultAction(submission.id, { rejectionReason: reason }),
        success: `${submission.title} rejected. The seller has been told.`,
      }),
    [ask],
  );

  const actionsFor = useCallback(
    (submission: SubmissionActionTarget): OverflowAction[] => {
      const actions: OverflowAction[] = [];
      if (submission.status === "submitted") {
        actions.push({
          id: "start-review",
          label: "Start review",
          onSelect: () =>
            run(
              () => adminStartSubmissionReviewResultAction(submission.id),
              `${submission.title} is under review`,
            ),
        });
      }
      if (submission.status === "under_review") {
        actions.push({
          id: "accept",
          label: "Accept for cataloguing",
          onSelect: () => accept(submission),
          ...(submission.blocksAccept
            ? { disabledReason: "Required details are missing from the submission" }
            : {}),
        });
      }
      if (submission.status === "approved") {
        actions.push({ id: "convert", label: "Create lot", href: submission.decisionHref });
      }
      if (submission.status === "submitted" || submission.status === "under_review") {
        actions.push(
          submission.assignedToMe
            ? {
                id: "unassign",
                label: "Unassign me",
                onSelect: () =>
                  run(
                    () => adminAssignSubmissionResultAction(submission.id, null),
                    `${submission.title} is unassigned`,
                  ),
              }
            : {
                id: "assign-me",
                label: "Assign to me",
                onSelect: () =>
                  run(
                    () => adminAssignSubmissionResultAction(submission.id, currentUserId),
                    `${submission.title} is assigned to you`,
                  ),
              },
        );
      }
      if (submission.status === "under_review") {
        actions.push({
          id: "reject",
          label: "Reject…",
          tone: "danger",
          onSelect: () => reject(submission),
        });
      }
      return actions;
    },
    [accept, reject, run, currentUserId],
  );

  return { actionsFor, accept, reject, dialogs: confirm.dialog };
}
