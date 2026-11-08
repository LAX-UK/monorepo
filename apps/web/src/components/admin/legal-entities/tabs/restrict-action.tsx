"use client";

import { ClientMessageField } from "@/components/admin/legal-entities/client-message-field";
import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import { legalEntityRestrictResultAction } from "@/lib/admin/legal-entity-lifecycle.actions";
import { StaffButton } from "@auction/staff-ui";
import type { LegalEntity } from "@auction/types";
import { useRef } from "react";

const REASON_MIN = 3;

type Props = {
  entity: LegalEntity;
};

/**
 * Restricts an approved organisation after asking why. Bidding, registering and sending works
 * pause; the organisation keeps its history and can pay what it already owes. Its members read
 * the optional message written here until the restriction is lifted.
 */
export function RestrictAction({ entity }: Props) {
  const confirm = useStaffConfirm();
  const message = useRef("");

  const ask = () => {
    message.current = "";
    confirm.ask({
      title: `Restrict ${entity.displayName}?`,
      description:
        "Bidding, registering and sending works are paused for this organisation. Its members can still read their history and pay invoices already issued, and they see a notice on their Home page until the restriction is lifted.",
      confirmLabel: "Restrict organisation",
      cancelLabel: "Keep approved",
      stepUpAction: "restrict this organisation",
      reason: {
        label: "Reason for restricting",
        description: `At least ${REASON_MIN} characters. Kept in the audit log.`,
        minLength: REASON_MIN,
        maxLength: 4000,
      },
      body: (
        <ClientMessageField
          purpose="to explain the restriction"
          onChange={(value) => {
            message.current = value;
          }}
        />
      ),
      run: ({ reason }) => legalEntityRestrictResultAction(entity.id, reason, message.current),
      success: `${entity.displayName} restricted`,
    });
  };

  return (
    <>
      <StaffButton variant="secondary" size="sm" onClick={ask}>
        Restrict
      </StaffButton>
      {confirm.dialog}
    </>
  );
}
