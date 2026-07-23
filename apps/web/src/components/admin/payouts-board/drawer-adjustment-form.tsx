"use client";

import { PendingFormSubmit } from "@/components/admin/pending-form-submit";
import { addPayoutAdjustmentAction } from "@/lib/admin/finance/admin-finance-mutations";
import type { AdminPayoutBoardRow } from "@/lib/data/view-models/admin-payouts-table.vm";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";

type Props = {
  payout: AdminPayoutBoardRow;
  disabled: boolean;
};

export function PayoutDrawerAdjustmentForm({ payout, disabled }: Props) {
  const formId = `payout-adjustment-${payout.id}`;

  return (
    <form
      id={formId}
      action={addPayoutAdjustmentAction}
      className="space-y-3 rounded-md border border-outline-variant/30 p-3"
    >
      <input type="hidden" name="payoutId" value={payout.id} />
      <h3 className="font-label text-sm font-semibold uppercase tracking-wide">Add adjustment</h3>
      <p className="text-xs text-on-surface-variant">
        Adjustments update gross and net totals while the payout is still scheduled or in transit.
      </p>
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <div className="space-y-1">
          <Label htmlFor={`${formId}-amount`}>Amount</Label>
          <Input
            id={`${formId}-amount`}
            name="amount"
            required
            placeholder="-25.00"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${formId}-note`}>Note</Label>
          <Input
            id={`${formId}-note`}
            name="note"
            required
            minLength={10}
            placeholder="Reason for adjustment"
            disabled={disabled}
          />
        </div>
      </div>
      <PendingFormSubmit
        formId={formId}
        pendingLabel="Saving adjustment…"
        disabled={disabled}
        className="rounded-md border border-outline-variant px-4 py-2 font-label text-sm font-semibold disabled:opacity-50"
      >
        Add adjustment
      </PendingFormSubmit>
    </form>
  );
}
