"use client";

import { adminAssignSubmissionResultAction } from "@/lib/actions/admin-submissions";
import { notify } from "@/lib/ui/notify";
import type { ItemSubmissionStatus } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { UserCheck, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Props = {
  submissionId: string;
  status: ItemSubmissionStatus;
  assignedToUserId: string | null | undefined;
  currentUserId: string;
  assigneeDisplayName?: string | null;
};

const ASSIGNABLE_STATUSES: ItemSubmissionStatus[] = ["submitted", "under_review"];

export function SubmissionAssignControl({
  submissionId,
  status,
  assignedToUserId,
  currentUserId,
  assigneeDisplayName,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isMine = assignedToUserId === currentUserId;
  const isAssigned = assignedToUserId != null && assignedToUserId !== "";

  if (!ASSIGNABLE_STATUSES.includes(status)) {
    return null;
  }

  function assign(nextAssignee: string | null) {
    startTransition(async () => {
      const result = await adminAssignSubmissionResultAction(submissionId, nextAssignee);
      if (result.ok) {
        notify.success(nextAssignee ? "Assigned to you" : "Assignment cleared");
        router.refresh();
      } else {
        notify.error(result.error);
      }
    });
  }

  const assigneeName = assigneeDisplayName?.trim() || "another reviewer";

  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      {isAssigned && !isMine ? <span className="sr-only">Assigned to {assigneeName}</span> : null}
      {!isMine ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="min-h-9"
          disabled={pending}
          aria-busy={pending}
          onClick={() => assign(currentUserId)}
        >
          <UserCheck className="size-4" aria-hidden />
          Assign to me
        </Button>
      ) : null}
      {isAssigned ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="min-h-9"
          disabled={pending}
          aria-busy={pending}
          onClick={() => assign(null)}
        >
          <UserMinus className="size-4" aria-hidden />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
