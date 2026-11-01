"use client";

import {
  assignConsignmentThreadAction,
  closeConsignmentThreadAction,
  markConsignmentThreadUnreadAction,
  reopenConsignmentThreadAction,
} from "@/lib/actions/consignment-inbox";
import { notify } from "@/lib/ui/notify";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

type Person = { userId: string; name: string };

/**
 * What staff do to a thread besides writing: assign or cover (with Undo), close and reopen
 * (Close undoes to open), and mark unread. Every outcome is said in a toast; a refusal says the
 * API's reason and changes nothing.
 */
export function useThreadActions(input: {
  submissionId: string;
  /** Who has it now, for Undo after an assignment. */
  assignee: (Person & { covering: boolean }) | null;
  specialist: Person | null;
  /** Called after a change lands (the page refreshes itself by default). */
  onChanged?: () => void;
}) {
  const router = useRouter();
  const { submissionId, assignee, onChanged } = input;
  const done = useCallback(() => (onChanged ? onChanged() : router.refresh()), [onChanged, router]);

  const assign = useCallback(
    async (person: Person | null, covering: boolean) => {
      const result = await assignConsignmentThreadAction(submissionId, {
        assignedToUserId: person?.userId ?? null,
        covering,
      });
      if (!result.ok) {
        notify.error("The thread was not assigned", { description: result.error });
        return;
      }
      done();
      const previous = assignee;
      const title = person
        ? covering
          ? `${person.name} is covering this thread`
          : `Assigned to ${person.name}`
        : "Unassigned";
      notify.action(title, {
        onAction: () =>
          void assignConsignmentThreadAction(submissionId, {
            assignedToUserId: previous?.userId ?? null,
            covering: previous?.covering ?? false,
          }).then((back) => {
            if (back.ok) done();
            else notify.error("The change was not undone", { description: back.error });
          }),
      });
    },
    [assignee, done, submissionId],
  );

  const close = useCallback(async () => {
    const result = await closeConsignmentThreadAction(submissionId);
    if (!result.ok) {
      notify.error("The thread was not closed", { description: result.error });
      return;
    }
    done();
    notify.action("Thread closed", {
      description: "It reopens if the client writes again.",
      onAction: () =>
        void reopenConsignmentThreadAction(submissionId).then((back) => {
          if (back.ok) done();
        }),
    });
  }, [done, submissionId]);

  const reopen = useCallback(async () => {
    const result = await reopenConsignmentThreadAction(submissionId);
    if (!result.ok) {
      notify.error("The thread was not reopened", { description: result.error });
      return;
    }
    done();
    notify.success("Thread reopened");
  }, [done, submissionId]);

  const markUnread = useCallback(async () => {
    const result = await markConsignmentThreadUnreadAction(submissionId);
    if (!result.ok) {
      notify.error("The thread was not marked unread", { description: result.error });
      return;
    }
    notify.success("Marked as unread");
    done();
  }, [done, submissionId]);

  return { assign, close, reopen, markUnread };
}
