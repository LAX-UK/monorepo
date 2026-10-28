"use client";

import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import { updateEnquiry } from "@/server/application/admin-enquiry-actions.server";
import type { AdminMutationResult } from "@/server/application/admin-mutation-result";
import { enquirySenderName } from "@/server/domain/enquiry-inbox.vm";
import type { EnquiryAssignee, EnquiryKind, EnquiryStatus } from "@auction/shop-contracts";
import { ConfirmActionDialog, type OverflowAction, toast, toastUndo } from "@auction/staff-ui";
import { CircleCheck, RotateCcw, UserMinus, UserPlus } from "@auction/staff-ui/icons";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

/** What a move needs to know about an enquiry, from a list row or from the conversation page. */
export type EnquiryTarget = {
  kind: EnquiryKind;
  id: string;
  /** Sent back as `expectedVersion`, so two people working the inbox never overwrite each other. */
  version: string;
  status: EnquiryStatus;
  assignee: EnquiryAssignee | null;
  sender: { name: string | null; email: string | null };
};

type Change = { status?: EnquiryStatus; assigneeSubject?: string | null };

/** Closed enquiries go back to the state their assignment implies. */
export function reopenedStatus(target: Pick<EnquiryTarget, "assignee">): EnquiryStatus {
  return target.assignee ? "in_progress" : "new";
}

/**
 * An enquiry's moves, the same from the list's row menu and panel and from the conversation page:
 * assign to me or unassign (with Undo), reassign, close (after a confirmation) and reopen. Each
 * move is saved against the version the screen was rendered with; when someone else got there
 * first nothing is written and `conflict` is set, for the screen to offer a reload.
 */
export function useEnquiryActions({ currentSubject }: { currentSubject: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [closing, setClosing] = useState<EnquiryTarget | null>(null);

  const send = useCallback(
    async (
      target: Pick<EnquiryTarget, "kind" | "id">,
      expectedVersion: string,
      change: Change,
    ): Promise<AdminMutationResult<{ version: string }>> => {
      try {
        return await updateEnquiry({
          kind: target.kind,
          id: target.id,
          expectedVersion,
          ...change,
        });
      } catch {
        return { ok: false, kind: "failed", message: "The change did not save. Try again." };
      }
    },
    [],
  );

  const fail = useCallback(
    (title: string, result: Extract<AdminMutationResult<unknown>, { ok: false }>) => {
      if (result.kind === "conflict") setConflict(true);
      else toast.error(title, { description: adminMutationErrorMessage(result) });
    },
    [],
  );

  const save = useCallback(
    async (
      target: EnquiryTarget,
      change: Change,
      done: { title: string; failTitle: string; undo?: Change },
    ): Promise<boolean> => {
      setPending(true);
      setConflict(false);
      const result = await send(target, target.version, change);
      setPending(false);
      if (!result.ok) {
        fail(done.failTitle, result);
        return false;
      }
      router.refresh();
      const undo = done.undo;
      if (!undo) {
        toast.success(done.title);
        return true;
      }
      toastUndo({
        title: done.title,
        onUndo: () => {
          void send(target, result.data.version, undo).then((back) => {
            if (back.ok) router.refresh();
            else fail("Could not undo", back);
          });
        },
      });
      return true;
    },
    [fail, router, send],
  );

  const assign = useCallback(
    (target: EnquiryTarget, person: EnquiryAssignee | null, personName: string) =>
      save(
        target,
        { assigneeSubject: person?.subject ?? null },
        {
          title: person ? `Assigned to ${personName}` : "Unassigned",
          failTitle: person ? "Could not assign" : "Could not unassign",
          undo: { assigneeSubject: target.assignee?.subject ?? null },
        },
      ),
    [save],
  );

  const assignToMe = (target: EnquiryTarget) =>
    save(
      target,
      { assigneeSubject: currentSubject },
      {
        title: "Assigned to you",
        failTitle: "Could not assign",
        undo: { assigneeSubject: target.assignee?.subject ?? null },
      },
    );

  const unassign = (target: EnquiryTarget) =>
    save(
      target,
      { assigneeSubject: null },
      {
        title: "Unassigned",
        failTitle: "Could not unassign",
        undo: { assigneeSubject: target.assignee?.subject ?? null },
      },
    );

  const reopen = (target: EnquiryTarget) =>
    save(
      target,
      { status: reopenedStatus(target) },
      { title: "Enquiry reopened", failTitle: "Could not reopen" },
    );

  const closeNow = (target: EnquiryTarget) =>
    save(target, { status: "closed" }, { title: "Enquiry closed", failTitle: "Could not close" });

  /** The moves open to this enquiry, for a row menu or an overflow menu. */
  const actionsFor = (target: EnquiryTarget): OverflowAction[] => {
    const mine = target.assignee?.subject === currentSubject;
    const assignment: OverflowAction[] = mine
      ? [
          {
            id: "unassign",
            label: "Unassign me",
            icon: UserMinus,
            onSelect: () => void unassign(target),
          },
        ]
      : [
          {
            id: "assign-me",
            label: "Assign to me",
            icon: UserPlus,
            onSelect: () => void assignToMe(target),
          },
          ...(target.assignee
            ? [
                {
                  id: "unassign",
                  label: "Unassign",
                  icon: UserMinus,
                  onSelect: () => void unassign(target),
                },
              ]
            : []),
        ];
    const status: OverflowAction =
      target.status === "closed"
        ? { id: "reopen", label: "Reopen", icon: RotateCcw, onSelect: () => void reopen(target) }
        : {
            id: "close",
            label: "Close enquiry…",
            icon: CircleCheck,
            onSelect: () => setClosing(target),
          };
    // Every move changes the enquiry, so each needs the capability the API checks for it.
    return [...(target.status === "closed" ? [] : assignment), status].map((action) => ({
      ...action,
      requires: "enquiry.write",
    }));
  };

  const dialogs = closing ? (
    <ConfirmActionDialog
      open
      onOpenChange={(open) => {
        if (!open) setClosing(null);
      }}
      title={`Close the enquiry from ${enquirySenderName(closing.sender)}?`}
      description="It moves to Closed and stops counting towards the number beside Enquiries. The client is not notified. You can reopen it later."
      confirmLabel="Close enquiry"
      cancelLabel="Keep open"
      loading={pending}
      onConfirm={async () => {
        await closeNow(closing);
        setClosing(null);
      }}
    />
  ) : null;

  return {
    pending,
    conflict,
    dismissConflict: () => setConflict(false),
    reload: () => {
      setConflict(false);
      router.refresh();
    },
    assign,
    assignToMe,
    unassign,
    reopen,
    requestClose: setClosing,
    actionsFor,
    dialogs,
  };
}

export type EnquiryActions = ReturnType<typeof useEnquiryActions>;
