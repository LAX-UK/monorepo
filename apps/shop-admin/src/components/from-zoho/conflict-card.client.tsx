"use client";

import { useAdminAction } from "@/components/use-admin-action.client";
import { resolveRegisterConflict } from "@/server/application/admin-register-actions.server";
import {
  ACCEPT_ZOHO_LABEL,
  CONFLICT_FIELD_LABEL,
  type ConflictDecision,
  KEEP_LAX_LABEL,
  conflictDecisionCopy,
  presentConflictValue,
  setInLaxLine,
} from "@/server/domain/zoho-register.vm";
import type { AdminRegisterConflict } from "@auction/shop-contracts";
import { ConfirmActionDialog, Permitted, Section, StaffButton, StaffDate } from "@auction/staff-ui";
import { useState } from "react";

const REVIEW = "artwork_register.review";

function Side({
  label,
  value,
  field,
}: {
  label: string;
  value: string | null;
  field: AdminRegisterConflict["field"];
}) {
  const shown = presentConflictValue(field, value);
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-staff-md border border-staff-line-subtle bg-staff-sunken px-3 py-2.5">
      <p className="text-staff-xs font-medium text-staff-muted">{label}</p>
      {shown ? (
        <p className="break-words text-staff-md font-medium text-staff-fg">{shown}</p>
      ) : (
        <p className="text-staff-md text-staff-muted">Empty</p>
      )}
    </div>
  );
}

/**
 * A conflict waiting for a decision: Zoho's value and LAX's side by side, and the two ways to
 * settle it. LAX keeps its own value until someone decides. The actions are for people who may
 * review; everyone else sees both values and who can decide.
 */
export function ConflictCard({ conflict }: { conflict: AdminRegisterConflict }) {
  const [deciding, setDeciding] = useState<ConflictDecision | null>(null);
  const action = useAdminAction();
  const label = CONFLICT_FIELD_LABEL[conflict.field];
  const copy = deciding ? conflictDecisionCopy(conflict, deciding) : null;

  return (
    <Section
      title={`Needs a decision: ${label.toLowerCase()}`}
      description={
        <>
          Zoho changed this on <StaffDate value={conflict.zohoModifiedAt} />. LAX keeps its own
          value until someone decides.
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Side label="In Zoho" value={conflict.zohoValue} field={conflict.field} />
          <Side label="In LAX" value={conflict.laxValue} field={conflict.field} />
        </div>
        {conflict.canAcceptZoho ? null : (
          <p className="text-staff-sm text-staff-muted">{setInLaxLine(conflict)}</p>
        )}
        <Permitted
          requires={REVIEW}
          fallback={
            <p className="text-staff-sm text-staff-muted">
              Administrators and catalogue editors can decide this.
            </p>
          }
        >
          <div className="flex flex-wrap gap-2">
            <StaffButton variant="secondary" onClick={() => setDeciding("kept_lax")}>
              {KEEP_LAX_LABEL}
            </StaffButton>
            {conflict.canAcceptZoho ? (
              <StaffButton variant="secondary" onClick={() => setDeciding("accepted_zoho")}>
                {ACCEPT_ZOHO_LABEL}
              </StaffButton>
            ) : null}
          </div>
        </Permitted>
      </div>
      {copy && deciding ? (
        <>
          <ConfirmActionDialog
            open
            onOpenChange={(open) => {
              if (!open) setDeciding(null);
            }}
            title={copy.title}
            description={copy.description}
            confirmLabel={copy.confirmLabel}
            loading={action.pending}
            onConfirm={async () => {
              const ok = await action.run(
                () =>
                  resolveRegisterConflict({
                    conflictId: conflict.conflictId,
                    resolution: deciding,
                    idempotencyKey: action.idempotencyKey,
                  }),
                copy.success,
              );
              if (ok) setDeciding(null);
            }}
          >
            {action.error}
          </ConfirmActionDialog>
          {action.stepUpDialog}
        </>
      ) : null}
    </Section>
  );
}
