"use client";

import { StaffMemberPicker } from "@/components/admin/staff/staff-member-picker";
import { adminAssignSubmissionResultAction } from "@/lib/actions/admin-submissions";
import { SUBMISSIONS_ACCESS } from "@/lib/navigation/staff-nav-access";
import { notify } from "@/lib/ui/notify";
import { Field, Notice, StaffButton, StaffDialog } from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string;
  /** The submission's title, for the question. */
  title: string;
  assignedToUserId: string | null | undefined;
};

/**
 * Hands a submission to a named reviewer, or takes the assignment away. Reviewers are chosen by
 * name and role among the staff who can review submissions, never by account ID.
 */
export function SubmissionReassignDialog({
  open,
  onOpenChange,
  submissionId,
  title,
  assignedToUserId,
}: Props) {
  const router = useRouter();
  const current = assignedToUserId?.trim() ? assignedToUserId.trim() : null;
  const [chosen, setChosen] = useState<string | null>(current);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setChosen(current);
      setFailure(null);
    }
  }, [open, current]);

  const assign = (userId: string | null) => {
    setFailure(null);
    startTransition(async () => {
      const result = await adminAssignSubmissionResultAction(submissionId, userId);
      if (result.ok) {
        notify.success(userId ? "Reviewer assigned" : "Assignment cleared");
        onOpenChange(false);
        router.refresh();
        return;
      }
      setFailure(result.error);
    });
  };

  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
      title={current ? `Reassign ${title}?` : `Assign ${title}`}
      description="The reviewer sees it in their queue."
      footer={
        <>
          {current ? (
            <StaffButton
              variant="ghost"
              disabled={pending}
              onClick={() => assign(null)}
              className="sm:mr-auto"
            >
              Clear assignment
            </StaffButton>
          ) : null}
          <StaffButton variant="secondary" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancel
          </StaffButton>
          <StaffButton
            variant="primary"
            loading={pending}
            {...(chosen && chosen !== current
              ? {}
              : {
                  disabledReason: chosen ? "Already assigned to them" : "Choose a reviewer first",
                })}
            onClick={() => assign(chosen)}
          >
            Assign reviewer
          </StaffButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {failure ? (
          <Notice tone="danger" alert title="The assignment was not saved">
            {failure}
          </Notice>
        ) : null}
        <Field label="Reviewer" description="Staff who can review submissions.">
          <StaffMemberPicker
            value={chosen}
            access={SUBMISSIONS_ACCESS}
            placeholder="Choose a reviewer"
            disabled={pending}
            onValueChange={(option) => setChosen(option?.id ?? null)}
          />
        </Field>
      </div>
    </StaffDialog>
  );
}
