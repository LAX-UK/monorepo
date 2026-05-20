"use client";

import { PendingFormSubmit } from "@/components/admin/pending-form-submit";
import { runPayoutSettlementAction } from "@/lib/admin/payout.actions";

const FORM_ID = "payout-settlement-form";

export function PayoutSettlementForm() {
  return (
    <form id={FORM_ID} action={runPayoutSettlementAction} className="space-y-3">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Legal entity ID</span>
        <input
          name="legalEntityId"
          required
          placeholder="00000000-0000-4000-8000-000000000000"
          className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2"
        />
      </label>
      <PendingFormSubmit
        formId={FORM_ID}
        pendingLabel="Running settlement…"
        className="rounded-md bg-primary px-4 py-2 font-label text-sm font-semibold text-on-primary"
      >
        Run settlement
      </PendingFormSubmit>
    </form>
  );
}
