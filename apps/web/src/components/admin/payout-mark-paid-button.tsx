"use client";

import { ConfirmFormSubmit } from "@/components/admin/confirm-form-submit";
import { markPayoutPaidAction } from "@/lib/admin/payout.actions";

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
      <label className="block space-y-1 text-sm">
        <span>Stripe transfer ID</span>
        <input
          name="stripeTransferId"
          required
          defaultValue={stripeTransferId}
          placeholder="tr_..."
          className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2"
        />
      </label>
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
