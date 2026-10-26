"use client";

import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import { sofReopenAction } from "@/lib/actions/compliance";
import { StaffButton } from "@auction/staff-ui";

/** Reopen a rejected case for review, after confirming; maker-checker fields are cleared. */
export function SofReopenButton({ caseId }: { caseId: string }) {
  const confirm = useStaffConfirm();

  return (
    <>
      <StaffButton
        variant="secondary"
        onClick={() =>
          confirm.ask({
            title: "Reopen this rejected case?",
            description: "Maker-checker fields are cleared and the case returns to pending review.",
            confirmLabel: "Reopen for review",
            cancelLabel: "Keep rejected",
            run: () => sofReopenAction({ caseId }),
            success: "Rejected case reopened for review",
          })
        }
      >
        Reopen for review
      </StaffButton>
      {confirm.dialog}
    </>
  );
}
