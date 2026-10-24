"use client";

import { TypedConfirmationDialog } from "@/components/admin/typed-confirmation-dialog";
import {
  adminApproveWithdrawalRequestResultAction,
  adminDeclineWithdrawalRequestResultAction,
} from "@/lib/actions/admin";
import { handleStaffStepUp } from "@/lib/auth/step-up/staff-step-up.client";
import { notify } from "@/lib/ui/notify";
import { Field, StaffButton, StaffDialog, TextArea } from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const APPROVE_PHRASE = "APPROVE WITHDRAWAL";
const REASON_MAX_LENGTH = 1000;

type Props = {
  lotId: string;
  /** From the withdrawal decision rule shared with the API; without it no decision is offered. */
  canDecide: boolean;
};

/**
 * Approve (cancels the lot) or decline (keeps the lot and emails the seller the reason).
 * Staff without the auction management capability see who can decide instead of buttons the
 * API would refuse.
 */
export function WithdrawalDecisionActions({ lotId, canDecide }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [approveOpen, setApproveOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  if (!canDecide) {
    return (
      <p className="text-staff-sm text-staff-muted">
        Only auction managers can approve or decline withdrawal requests.
      </p>
    );
  }

  const decline = () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setReasonError("Tell the seller why the lot stays in the sale.");
      return;
    }
    setReasonError(null);
    startTransition(async () => {
      const r = await adminDeclineWithdrawalRequestResultAction(lotId, trimmed);
      if (r.ok) {
        notify.success("Withdrawal declined. The seller has been told.");
        setDeclineOpen(false);
        setReason("");
        router.refresh();
      } else {
        if (handleStaffStepUp(r)) return;
        notify.error("Decline failed", { description: r.error });
      }
    });
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <StaffButton variant="primary" disabled={pending} onClick={() => setApproveOpen(true)}>
          Approve withdrawal
        </StaffButton>
        <StaffButton variant="secondary" disabled={pending} onClick={() => setDeclineOpen(true)}>
          Decline withdrawal
        </StaffButton>
      </div>
      <TypedConfirmationDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title="Approve lot withdrawal?"
        description={`Type ${APPROVE_PHRASE} to cancel the lot and approve the seller withdrawal request.`}
        actionLabel="Approve withdrawal"
        confirmationPhrase={APPROVE_PHRASE}
        severity="warning"
        onConfirm={() => {
          startTransition(async () => {
            const r = await adminApproveWithdrawalRequestResultAction(lotId);
            if (r.ok) {
              notify.success("Withdrawal approved. Lot cancelled.");
              router.refresh();
            } else {
              if (handleStaffStepUp(r)) return;
              notify.error("Approval failed", { description: r.error });
            }
          });
        }}
      />
      <StaffDialog
        open={declineOpen}
        onOpenChange={(open) => {
          setDeclineOpen(open);
          if (!open) setReasonError(null);
        }}
        title="Decline lot withdrawal?"
        description="The lot stays as it is. The seller organisation is emailed your reason."
        footer={
          <>
            <StaffButton
              variant="secondary"
              disabled={pending}
              onClick={() => setDeclineOpen(false)}
            >
              Cancel
            </StaffButton>
            <StaffButton variant="primary" loading={pending} onClick={decline}>
              Decline and notify seller
            </StaffButton>
          </>
        }
      >
        <Field label="Reason for the seller" error={reasonError}>
          <TextArea
            value={reason}
            maxLength={REASON_MAX_LENGTH}
            rows={4}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
      </StaffDialog>
    </>
  );
}
