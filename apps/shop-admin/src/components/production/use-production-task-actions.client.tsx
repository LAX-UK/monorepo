"use client";

import { useAdminAction } from "@/components/use-admin-action.client";
import { updateProductionTask } from "@/server/application/admin-production-actions.server";
import {
  PRODUCTION_STATUS_LABELS,
  productionAssigneeName,
  productionTaskSteps,
  productionTaskTitle,
} from "@/server/domain/production-queue.vm";
import type {
  AdminProductionTaskListItem,
  ProductionTaskStaff,
  ProductionTaskStatus,
} from "@auction/shop-contracts";
import {
  ConfirmActionDialog,
  type EnumOption,
  type OverflowAction,
  StaffButton,
  StaffDialog,
} from "@auction/staff-ui";
import { ArrowRight, UserMinus, UserPlus, XCircle } from "@auction/staff-ui/icons";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

type Task = AdminProductionTaskListItem;
type Change = { status?: ProductionTaskStatus; assigneeSubject?: string | null };

export const UNASSIGNED = "__unassigned__";

/**
 * A production task's moves, the same from the row menu, the panel and the task's page. Each
 * move is saved against the version the page was rendered with, so two people working the queue
 * get a "this task changed" dialog and a fresh list rather than a silent overwrite. Cancelling
 * asks first, because a cancelled task cannot be reopened.
 */
export function useProductionTaskActions({
  assignees,
  currentSubject,
}: {
  assignees: readonly ProductionTaskStaff[];
  currentSubject: string;
}) {
  const router = useRouter();
  const action = useAdminAction();
  const [cancelling, setCancelling] = useState<Task | null>(null);
  const [conflict, setConflict] = useState(false);

  const save = useCallback(
    async (task: Task, change: Change, message: string) => {
      let conflicted = false;
      const ok = await action.run(
        async () => {
          const result = await updateProductionTask({
            id: task.taskId,
            expectedVersion: task.version,
            ...change,
          });
          conflicted = !result.ok && result.kind === "conflict";
          return result;
        },
        message,
        "update this task",
      );
      if (conflicted) setConflict(true);
      return ok;
    },
    [action.run],
  );

  const forwardSteps = (task: Task) =>
    productionTaskSteps(task.status).forward.map((step) => ({
      ...step,
      run: () =>
        void save(task, { status: step.to }, `Moved to ${PRODUCTION_STATUS_LABELS[step.to]}`),
    }));

  /** The task's usual next move, for a primary button; null once nothing is left to do. */
  const nextStep = (task: Task) => forwardSteps(task)[0] ?? null;

  const assign = (task: Task, subject: string | null) => {
    if (subject === (task.assignee?.subject ?? null)) return;
    const person = assignees.find((member) => member.subject === subject);
    void save(
      task,
      { assigneeSubject: subject },
      subject ? `Assigned to ${person ? productionAssigneeName(person) : "them"}` : "Unassigned",
    );
  };

  /** Every move for the row menu and the overflow: steps, assignment, then cancel last. */
  const actionsFor = (task: Task, options: { skipNext?: boolean } = {}): OverflowAction[] => {
    const steps = forwardSteps(task).slice(options.skipNext ? 1 : 0);
    const mine = task.assignee?.subject === currentSubject;
    const cancel = productionTaskSteps(task.status).cancel;
    const terminal = steps.length === 0 && !cancel;
    return [
      ...steps.map((step) => ({
        id: `step-${step.to}`,
        label: step.label,
        icon: ArrowRight,
        onSelect: step.run,
      })),
      ...(terminal
        ? []
        : mine
          ? [
              {
                id: "unassign",
                label: "Unassign me",
                icon: UserMinus,
                onSelect: () => assign(task, null),
              },
            ]
          : [
              {
                id: "assign-me",
                label: "Assign to me",
                icon: UserPlus,
                onSelect: () => assign(task, currentSubject),
              },
            ]),
      ...(cancel
        ? [
            {
              id: "cancel",
              label: "Cancel task…",
              icon: XCircle,
              tone: "danger" as const,
              onSelect: () => setCancelling(task),
            },
          ]
        : []),
    ];
  };

  /** Everyone the task can be given to, with the person who holds it even if they have left. */
  const assigneeOptions = (task: Task): EnumOption<string>[] => {
    const staff =
      task.assignee && !assignees.some((member) => member.subject === task.assignee?.subject)
        ? [task.assignee, ...assignees]
        : assignees;
    return [
      { value: UNASSIGNED, label: "Unassigned" },
      ...staff.map((member) => ({
        value: member.subject,
        label:
          member.subject === currentSubject
            ? `${productionAssigneeName(member)} (you)`
            : productionAssigneeName(member),
      })),
    ];
  };

  const dialogs = (
    <>
      {cancelling ? (
        <ConfirmActionDialog
          open
          onOpenChange={(open) => {
            if (!open) setCancelling(null);
          }}
          title={`Cancel ${productionTaskTitle(cancelling)}?`}
          description={`The task is ${PRODUCTION_STATUS_LABELS[cancelling.status].toLowerCase()}. Cancelling stops production for this order line, and a cancelled task cannot be reopened; to make the edition again, create a new task from the order.`}
          confirmLabel="Cancel task"
          cancelLabel="Keep task"
          tone="danger"
          loading={action.pending}
          onConfirm={async () => {
            const ok = await save(cancelling, { status: "cancelled" }, "Task cancelled");
            if (ok) setCancelling(null);
          }}
        >
          {action.error}
        </ConfirmActionDialog>
      ) : null}
      <StaffDialog
        open={conflict}
        onOpenChange={setConflict}
        title="This task changed"
        description="Someone else updated it while you had it open. Reload to see their change, then try again."
        footer={
          <StaffButton
            variant="primary"
            onClick={() => {
              setConflict(false);
              router.refresh();
            }}
          >
            Reload
          </StaffButton>
        }
      />
      {action.stepUpDialog}
    </>
  );

  return {
    actionsFor,
    nextStep,
    assign,
    assigneeOptions,
    dialogs,
    pending: action.pending,
    error: cancelling ? null : action.error,
  };
}
