"use client";

import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import { legalEntityRestrictResultAction } from "@/lib/admin/legal-entity-lifecycle.actions";
import { StaffButton } from "@auction/staff-ui";
import type { LegalEntity } from "@auction/types";

const REASON_MIN = 3;

type Props = {
  entity: LegalEntity;
};

/**
 * Restricts an approved organisation after asking why. Restriction does not stop bidding or
 * consigning: the organisation sees an account-restrictions notice and its selling activity is
 * recorded for compliance review until the restriction is lifted.
 */
export function RestrictAction({ entity }: Props) {
  const confirm = useStaffConfirm();

  const ask = () =>
    confirm.ask({
      title: `Restrict ${entity.displayName}?`,
      description:
        "The organisation sees an account restrictions notice, and its selling activity is recorded for compliance review until the restriction is lifted. It can still bid and submit lots.",
      confirmLabel: "Restrict organisation",
      cancelLabel: "Keep approved",
      stepUpAction: "restrict this organisation",
      reason: {
        label: "Reason for restricting",
        description: `At least ${REASON_MIN} characters. Kept in the audit log.`,
        minLength: REASON_MIN,
        maxLength: 4000,
      },
      run: ({ reason }) => legalEntityRestrictResultAction(entity.id, reason),
      success: `${entity.displayName} restricted`,
    });

  return (
    <>
      <StaffButton variant="secondary" size="sm" onClick={ask}>
        Restrict
      </StaffButton>
      {confirm.dialog}
    </>
  );
}
