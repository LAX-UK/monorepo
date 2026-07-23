"use client";

import { AdminPayoutReverseButton } from "@/components/admin/admin-payout-reverse-button";
import { PayoutMarkPaidButton } from "@/components/admin/payout-mark-paid-button";
import type { AdminPayoutBoardRow } from "@/lib/data/view-models/admin-payouts-table.vm";

type Props = {
  payout: AdminPayoutBoardRow;
  canProcess: boolean;
  canReverse: boolean;
};

export function PayoutDrawerActions({ payout, canProcess, canReverse }: Props) {
  const adjustmentDisabled =
    !canProcess ||
    payout.status === "paid" ||
    payout.status === "failed" ||
    payout.status === "reversed" ||
    payout.status === "clawback_pending";

  return (
    <div className="space-y-4">
      {canProcess ? (
        <PayoutMarkPaidButton
          payoutId={payout.id}
          stripeTransferId={payout.stripeTransferId ?? ""}
          disabled={adjustmentDisabled}
        />
      ) : null}
      {canReverse ? <AdminPayoutReverseButton payoutId={payout.id} status={payout.status} /> : null}
    </div>
  );
}
