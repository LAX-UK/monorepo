"use client";

import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import { legalEntityLiftRestrictionResultAction } from "@/lib/admin/legal-entity-lifecycle.actions";
import { isStripeAccountConfigured } from "@auction/connect";
import { StaffButton } from "@auction/staff-ui";
import type { LegalEntity } from "@auction/types";

const REASON_MIN = 3;

type Props = {
  entity: LegalEntity;
};

/**
 * Lifts a restriction after asking why. The organisation goes back to approved only when Stripe
 * Connect is ready, using the rule the Connect sync uses; otherwise it waits for Connect setup,
 * and the dialog says which of the two will happen.
 */
export function LiftRestrictionAction({ entity }: Props) {
  const confirm = useStaffConfirm();
  const ready = isStripeAccountConfigured(entity);

  const ask = () =>
    confirm.ask({
      title: `Lift the restriction on ${entity.displayName}?`,
      description: ready
        ? "Stripe Connect is ready, so the organisation returns to approved and its restrictions notice is removed."
        : "Stripe Connect is not ready, so the organisation moves to Connect pending until its account can take payouts.",
      confirmLabel: "Lift restriction",
      cancelLabel: "Keep restricted",
      stepUpAction: "lift this restriction",
      reason: {
        label: "Reason for lifting",
        description: `At least ${REASON_MIN} characters. Kept in the audit log.`,
        minLength: REASON_MIN,
        maxLength: 4000,
      },
      run: ({ reason }) => legalEntityLiftRestrictionResultAction(entity.id, reason),
      success: ready
        ? `${entity.displayName} approved again`
        : `${entity.displayName} moved to Connect pending`,
    });

  return (
    <>
      <StaffButton variant="secondary" size="sm" onClick={ask}>
        Lift restriction
      </StaffButton>
      {confirm.dialog}
    </>
  );
}
