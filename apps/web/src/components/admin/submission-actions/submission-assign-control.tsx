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
};

const ASSIGNABLE_STATUSES: ItemSubmissionStatus[] = ["submitted", "under_review"];

export function SubmissionAssignControl({
  submissionId,
  status,
  assignedToUserId,
  currentUserId,
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

  return (
    <div className="space-y-2 rounded-lg border border-border-hairline bg-surface-container-low/40 p-4">
      <p className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
        Assignment
      </p>
      <p className="text-sm text-on-surface-variant">
        {isMine ? "Assigned to you" : isAssigned ? "Assigned to another reviewer" : "Unassigned"}
      </p>
      <div className="flex flex-wrap gap-2">
        {!isMine ? (
          <Button
            type="button"
            size="sm"
            variant="secondaryOutline"
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
            disabled={pending}
            aria-busy={pending}
            onClick={() => assign(null)}
          >
            <UserMinus className="size-4" aria-hidden />
            Clear assignment
          </Button>
        ) : null}
      </div>
    </div>
  );
}
