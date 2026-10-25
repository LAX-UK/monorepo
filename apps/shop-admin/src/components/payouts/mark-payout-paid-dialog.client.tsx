"use client";

import { useAdminAction } from "@/components/use-admin-action.client";
import { markPayoutPaid } from "@/server/application/admin-operations-actions.server";
import {
  PAYOUT_PAID_REFERENCE_LIMIT,
  type PayoutRow,
  markPaidConfirmLabel,
  markPaidTitle,
  payoutReference,
  payoutSourceLabel,
} from "@/server/domain/payout-list.vm";
import {
  ConfirmActionDialog,
  KeyValueList,
  formatStaffDate,
  formatStaffMoney,
} from "@auction/staff-ui";

/**
 * Confirms a payout as paid, on the kit confirm. It names the payee, the amount and the payout's
 * reference, asks for the reference of the transfer that paid it, and the button repeats the
 * amount. Focus starts on Cancel. Money leaves the business, so the API asks for a recent
 * sign-in; when it is missing the kit's "Confirm it's you" dialog takes the person to sign in
 * again. The same request keeps its idempotency key until it succeeds.
 */
export function MarkPayoutPaidDialog({
  payout,
  open,
  onOpenChange,
}: {
  payout: PayoutRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const action = useAdminAction();
  const amount = formatStaffMoney(payout.netPence);

  return (
    <>
      <ConfirmActionDialog
        open={open}
        onOpenChange={onOpenChange}
        title={markPaidTitle(payout)}
        description="Do this once the transfer has left the bank. It cannot be undone."
        confirmLabel={markPaidConfirmLabel(payout)}
        loading={action.pending}
        reason={{
          label: "Transfer reference",
          description: "The bank or transfer reference, kept with the payout.",
          singleLine: true,
          maxLength: PAYOUT_PAID_REFERENCE_LIMIT,
          missingMessage: "Enter the reference from the transfer.",
        }}
        onConfirm={async ({ reason }) => {
          const ok = await action.run(
            () =>
              markPayoutPaid({
                payoutId: payout.payoutId,
                paidReference: reason,
                idempotencyKey: action.idempotencyKey,
              }),
            `Payout of ${amount} to ${payout.ownerDisplayName} marked paid`,
            `mark ${amount} paid`,
          );
          if (ok) onOpenChange(false);
        }}
      >
        <KeyValueList
          items={[
            { label: "Payee", value: payout.ownerDisplayName },
            { label: "Amount", value: amount, numeric: true },
            {
              label: "Payout reference",
              value: payoutReference(payout.payoutId),
              copyValue: payout.payoutId,
            },
            { label: "Source", value: payoutSourceLabel(payout.source) },
            { label: "Due", value: formatStaffDate(payout.payoutDueAt) },
          ]}
        />
        {action.error}
      </ConfirmActionDialog>
      {action.stepUpDialog}
    </>
  );
}
