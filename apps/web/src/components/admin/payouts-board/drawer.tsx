"use client";

import { AdminTechnicalIdDisclosure } from "@/components/admin/admin-technical-id-disclosure";
import { PayoutDrawerActions } from "@/components/admin/payouts-board/drawer-actions";
import { PayoutDrawerAdjustmentForm } from "@/components/admin/payouts-board/drawer-adjustment-form";
import { PayoutDrawerIssues } from "@/components/admin/payouts-board/drawer-issues";
import { PayoutDrawerSummary } from "@/components/admin/payouts-board/drawer-summary";
import type { AdminPayoutBoardRow } from "@/lib/data/view-models/admin-payouts-table.vm";
import Link from "next/link";

type Props = {
  payout: AdminPayoutBoardRow;
  capabilities: {
    canProcess: boolean;
    canReverse: boolean;
  };
};

export function PayoutDrawerContent({ payout, capabilities }: Props) {
  const adjustmentDisabled =
    !capabilities.canProcess ||
    payout.status === "paid" ||
    payout.status === "failed" ||
    payout.status === "reversed" ||
    payout.status === "clawback_pending";

  return (
    <div className="space-y-6">
      <PayoutDrawerSummary payout={payout} />

      <div className="min-w-0 text-sm">
        <p className="font-label text-[10px] uppercase text-on-surface-variant">Legal entity</p>
        <Link
          href={`/admin/legal-entities/${payout.legalEntityId}`}
          className="font-medium text-link underline"
        >
          View legal entity
        </Link>
      </div>

      <AdminTechnicalIdDisclosure
        items={[
          { label: "Payout ID", value: payout.id },
          { label: "Legal entity ID", value: payout.legalEntityId },
          { label: "Stripe transfer ID", value: payout.stripeTransferId },
        ]}
      />

      <PayoutDrawerIssues payout={payout} />

      {capabilities.canProcess ? (
        <PayoutDrawerAdjustmentForm payout={payout} disabled={adjustmentDisabled} />
      ) : null}

      <PayoutDrawerActions
        payout={payout}
        canProcess={capabilities.canProcess}
        canReverse={capabilities.canReverse}
      />
    </div>
  );
}
