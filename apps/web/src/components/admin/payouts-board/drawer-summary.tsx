"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminTableMoneyCell } from "@/components/admin/admin-table-money-cell";
import type { AdminPayoutBoardRow } from "@/lib/data/view-models/admin-payouts-table.vm";
import { formatDate, formatMoney } from "@/lib/ui/format";

type Props = {
  payout: AdminPayoutBoardRow;
};

export function PayoutDrawerSummary({ payout }: Props) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <AdminStatusBadge domain="payout" status={payout.status} />
        <span className="font-body text-sm text-on-surface-variant">
          {formatDate(payout.periodStart)} → {formatDate(payout.periodEnd)}
        </span>
      </div>

      <dl className="grid grid-cols-1 gap-3 text-sm">
        <div className="min-w-0">
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Net</dt>
          <dd>
            <AdminTableMoneyCell display={payout.netAmountDisplay} emphasis="default" />
          </dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Gross / fees</dt>
          <dd className="tabular-nums text-on-surface-variant">
            {formatMoney(payout.grossAmount, payout.currency)} · fee{" "}
            {formatMoney(payout.platformFee, payout.currency)} · Stripe{" "}
            {formatMoney(payout.stripeFee, payout.currency)}
          </dd>
        </div>
      </dl>
    </>
  );
}
