"use client";

import { AdminLegalEntityPicker } from "@/components/admin/admin-legal-entity-picker";
import { PendingFormSubmit } from "@/components/admin/pending-form-submit";
import { runPayoutSettlementAction } from "@/lib/admin/payout.actions";
import { useState } from "react";

const FORM_ID = "payout-settlement-form";

export function PayoutSettlementForm() {
  const [legalEntityId, setLegalEntityId] = useState<string | null>(null);
  const [legalEntityLabel, setLegalEntityLabel] = useState<string | null>(null);
  const pickerId = "payout-settlement-legal-entity";

  return (
    <form id={FORM_ID} action={runPayoutSettlementAction} className="space-y-3">
      <div className="block space-y-1 text-sm">
        <label htmlFor={pickerId} className="font-medium">
          Legal entity
        </label>
        <AdminLegalEntityPicker
          id={pickerId}
          value={legalEntityId}
          displayLabel={legalEntityLabel}
          onChange={(id, row) => {
            setLegalEntityId(id);
            setLegalEntityLabel(row?.displayName ?? null);
          }}
          searchPlaceholder="Search legal entities…"
        />
      </div>
      <input type="hidden" name="legalEntityId" value={legalEntityId ?? ""} />
      <PendingFormSubmit
        formId={FORM_ID}
        pendingLabel="Running settlement…"
        disabled={!legalEntityId}
        className="rounded-md bg-primary px-4 py-2 font-label text-sm font-semibold text-on-primary"
      >
        Run settlement
      </PendingFormSubmit>
    </form>
  );
}
