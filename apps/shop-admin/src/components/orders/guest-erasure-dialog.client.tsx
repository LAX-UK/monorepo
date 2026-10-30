"use client";

import { useAdminAction } from "@/components/use-admin-action.client";
import { eraseGuestData } from "@/server/application/admin-guest-actions.server";
import { GUEST_ERASURE_COPY } from "@/server/domain/guest-erasure.vm";
import {
  GUEST_ERASURE_REASON_MAX_LENGTH,
  GUEST_ERASURE_REASON_MIN_LENGTH,
} from "@auction/shop-domain";
import { ConfirmActionDialog } from "@auction/staff-ui";

/**
 * Confirms erasing a guest's personal data: says what goes and what stays, asks for the guest's
 * email typed in full and a reason for the audit log; a missing recent sign-in is asked for by
 * the kit's "Confirm it's you" dialog.
 */
export function GuestErasureDialog({
  open,
  onOpenChange,
  guestCustomerId,
  email,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestCustomerId: string;
  /** The guest's email, typed to confirm. */
  email: string;
}) {
  const action = useAdminAction();
  return (
    <>
      <ConfirmActionDialog
        open={open}
        onOpenChange={onOpenChange}
        title={GUEST_ERASURE_COPY.title}
        description={
          <>
            {action.error}
            <span className="block">{GUEST_ERASURE_COPY.description}</span>
          </>
        }
        confirmLabel={GUEST_ERASURE_COPY.confirm}
        tone="danger"
        loading={action.pending}
        typedConfirmation={email}
        reason={{
          label: "Reason",
          description: "Kept in the audit log, for example how and when the guest asked.",
          minLength: GUEST_ERASURE_REASON_MIN_LENGTH,
          maxLength: GUEST_ERASURE_REASON_MAX_LENGTH,
        }}
        onConfirm={async ({ reason }) => {
          const ok = await action.run(
            () =>
              eraseGuestData({
                guestCustomerId,
                confirmation: email,
                reason,
                idempotencyKey: action.idempotencyKey,
              }),
            GUEST_ERASURE_COPY.done,
            "erase this guest's data",
          );
          if (ok) onOpenChange(false);
        }}
      />
      {action.stepUpDialog}
    </>
  );
}
