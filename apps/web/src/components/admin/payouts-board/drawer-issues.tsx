"use client";

import type { AdminPayoutBoardRow } from "@/lib/data/view-models/admin-payouts-table.vm";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";

type Props = {
  payout: AdminPayoutBoardRow;
};

export function PayoutDrawerIssues({ payout }: Props) {
  return (
    <>
      {payout.failureReason ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Stripe transfer issue</AlertTitle>
          <AlertDescription>{payout.failureReason}</AlertDescription>
        </Alert>
      ) : null}

      {payout.status === "clawback_pending" ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Manual reconciliation required</AlertTitle>
          <AlertDescription>
            Negative net — recover funds via reversal, offset, or direct repayment before closing.
          </AlertDescription>
        </Alert>
      ) : null}

      {payout.statementGenerationError ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Statement PDF unavailable</AlertTitle>
          <AlertDescription>{payout.statementGenerationError}</AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}
