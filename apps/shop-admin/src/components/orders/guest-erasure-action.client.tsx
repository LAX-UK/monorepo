"use client";

import { useAdminAction } from "@/components/use-admin-action.client";
import { eraseGuestData } from "@/server/application/admin-guest-actions.server";
import { GUEST_ERASURE_COPY } from "@/server/domain/guest-erasure.vm";
import type { AdminGuestErasureState } from "@auction/shop-contracts";
import {
  GUEST_ERASURE_REASON_MAX_LENGTH,
  GUEST_ERASURE_REASON_MIN_LENGTH,
} from "@auction/shop-domain";
import { ConfirmActionDialog, StaffButton } from "@auction/staff-ui";
import { useId, useState } from "react";

/**
 * "Erase guest data" for one guest. The button says why when it cannot be used; erasing asks for
 * the guest's email typed in full, a reason for the audit log and a recent sign-in.
 */
export function GuestErasureAction({
  state,
  email,
}: {
  state: AdminGuestErasureState;
  /** The guest's email, typed to confirm. */
  email: string;
}) {
  const action = useAdminAction();
  const [open, setOpen] = useState(false);
  const blockedId = useId();
  const blocked = !state.allowed;

  return (
    <div className="flex flex-col gap-2 border-t border-staff-line-subtle pt-3">
      <div>
        <StaffButton
          size="sm"
          requires="lead.erase"
          disabled={blocked}
          {...(blocked ? { "aria-describedby": blockedId } : {})}
          onClick={() => setOpen(true)}
        >
          {GUEST_ERASURE_COPY.button}
        </StaffButton>
      </div>
      {blocked && state.blockedMessage ? (
        <p id={blockedId} className="m-0 text-staff-xs text-staff-muted">
          {state.blockedMessage}
        </p>
      ) : null}
      <ConfirmActionDialog
        open={open}
        onOpenChange={setOpen}
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
                guestCustomerId: state.guestCustomerId,
                confirmation: email,
                reason,
                idempotencyKey: action.idempotencyKey,
              }),
            GUEST_ERASURE_COPY.done,
            "erase this guest's data",
          );
          if (ok) setOpen(false);
        }}
      />
      {action.stepUpDialog}
    </div>
  );
}
