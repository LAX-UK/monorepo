"use client";

import { AdminMutationFeedback } from "@/components/admin-mutation-feedback";
import { useAdminMutation } from "@/components/use-admin-mutation";
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
  Button,
  ConfirmDialog,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

const UNASSIGNED = "__unassigned__";

type Change = { status?: ProductionTaskStatus; assigneeSubject?: string | null };

/**
 * Who has a task and what to do with it next. Each change is saved as soon as it is made, against
 * the version the page was rendered with, so two people working the queue get a conflict and a
 * fresh list rather than a silent overwrite. Cancelling asks first because it cannot be undone.
 */
export function ProductionTaskControls({
  task,
  assignees,
  currentSubject,
}: {
  task: AdminProductionTaskListItem;
  /** Active staff who can work on production. */
  assignees: ProductionTaskStaff[];
  currentSubject: string;
}) {
  const router = useRouter();
  const mutation = useAdminMutation();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [conflict, setConflict] = useState(false);
  const steps = productionTaskSteps(task.status);
  const title = productionTaskTitle(task);

  async function save(change: Change, successMessage: string) {
    setConflict(false);
    let conflicted = false;
    const saved = await mutation.run(async () => {
      const result = await updateProductionTask({
        id: task.taskId,
        expectedVersion: task.version,
        ...change,
      });
      conflicted = !result.ok && result.kind === "conflict";
      return result;
    }, successMessage);
    setConflict(conflicted);
    return saved;
  }

  // Someone who has since left the team can still hold an old task.
  const staff =
    task.assignee && !assignees.some((member) => member.subject === task.assignee?.subject)
      ? [task.assignee, ...assignees]
      : assignees;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Select
        value={task.assignee?.subject ?? UNASSIGNED}
        disabled={mutation.pending}
        onValueChange={(next) => {
          const assigneeSubject = next === UNASSIGNED ? null : next;
          if (assigneeSubject === (task.assignee?.subject ?? null)) return;
          void save({ assigneeSubject }, "Assignee updated");
        }}
      >
        <SelectTrigger aria-label={`Assignee for ${title}`} className="min-h-11 min-w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
          {staff.map((member) => (
            <SelectItem key={member.subject} value={member.subject}>
              {member.subject === currentSubject
                ? `${productionAssigneeName(member)} (you)`
                : productionAssigneeName(member)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {steps.forward.length > 0 || steps.cancel ? (
        <div className="flex flex-wrap gap-2">
          {steps.forward.map((step, index) => (
            <Button
              key={step.to}
              type="button"
              size="md"
              variant={index === 0 ? "default" : "outline"}
              disabled={mutation.pending}
              aria-label={`${step.label}: ${title}`}
              onClick={() =>
                void save({ status: step.to }, `Moved to ${PRODUCTION_STATUS_LABELS[step.to]}`)
              }
            >
              {step.label}
            </Button>
          ))}
          {steps.cancel ? (
            <Button
              type="button"
              size="md"
              variant="ghost"
              className="text-error"
              disabled={mutation.pending}
              aria-label={`${steps.cancel.label}: ${title}`}
              onClick={() => setConfirmCancel(true)}
            >
              {steps.cancel.label}
            </Button>
          ) : null}
        </div>
      ) : null}

      {conflict ? (
        <div role="alert" className="flex flex-col items-start gap-2 text-sm text-error">
          <p>Someone else updated this task while you had it open. Reload to see their changes.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setConflict(false);
              router.refresh();
            }}
          >
            Reload list
          </Button>
        </div>
      ) : (
        <AdminMutationFeedback
          message={mutation.message}
          stepUpRequired={mutation.stepUpRequired}
          stepUpHref={mutation.stepUpHref}
        />
      )}

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel this production task?"
        body={`${title} is ${PRODUCTION_STATUS_LABELS[task.status].toLowerCase()}. Cancelling stops production for this order line, and a cancelled task cannot be reopened. To make the edition again you would create a new task.`}
        confirmLabel="Cancel task"
        cancelLabel="Keep task"
        tone="danger"
        loading={mutation.pending}
        onConfirm={async () => {
          await save({ status: "cancelled" }, "Task cancelled");
          setConfirmCancel(false);
        }}
      />
    </div>
  );
}
