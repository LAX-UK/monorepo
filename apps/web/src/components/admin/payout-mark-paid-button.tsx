"use client";

import { ConfirmFormSubmit } from "@/components/admin/confirm-form-submit";
import { markPayoutPaidAction } from "@/lib/admin/finance/admin-finance-mutations";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";

type Props = {
  payoutId: string;
  stripeTransferId: string;
  disabled?: boolean;
};

export function PayoutMarkPaidButton({ payoutId, stripeTransferId, disabled }: Props) {
  const formId = `mark-payout-paid-${payoutId}`;

  return (
    <form id={formId} action={markPayoutPaidAction} className="space-y-3 rounded-md border p-3">
      <input type="hidden" name="payoutId" value={payoutId} />
      <h3 className="font-label text-sm font-semibold uppercase tracking-wide">Mark paid</h3>
      <div className="space-y-1">
        <Label htmlFor={`${formId}-transfer`}>Stripe transfer ID</Label>
        <Input
          id={`${formId}-transfer`}
          name="stripeTransferId"
          required
          defaultValue={stripeTransferId}
          placeholder="tr_..."
          disabled={disabled}
        />
      </div>
      <ConfirmFormSubmit
        formId={formId}
        disabled={disabled}
        className="rounded-md bg-primary px-4 py-2 font-label text-sm font-semibold text-on-primary disabled:opacity-50"
        confirmTitle="Mark payout as paid?"
        confirmBody="Confirm the Stripe transfer ID before recording this payout as paid."
        confirmLabel="Mark paid"
        tone="warning"
      >
        Mark paid
      </ConfirmFormSubmit>
    </form>
  );
}
