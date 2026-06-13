"use client";

import { AdminPayoutReverseButton } from "@/components/admin/admin-payout-reverse-button";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminTechnicalIdDisclosure } from "@/components/admin/admin-technical-id-disclosure";
import { PayoutMarkPaidButton } from "@/components/admin/payout-mark-paid-button";
import { addPayoutAdjustmentAction } from "@/lib/admin/payout.actions";
import type { AdminPayoutRow } from "@/lib/data/http/admin.server";
import { formatDate, formatMoney } from "@/lib/ui/format";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

export function PayoutDrawerContent({ payout }: { payout: AdminPayoutRow }) {
  const adjustmentDisabled =
    payout.status === "paid" ||
    payout.status === "failed" ||
    payout.status === "reversed" ||
    payout.status === "clawback_pending";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <AdminStatusBadge domain="payout" status={payout.status} />
        <span className="font-body text-sm text-on-surface-variant">
          {formatDate(payout.periodStart)} → {formatDate(payout.periodEnd)}
        </span>
      </div>

      <dl className="grid grid-cols-1 gap-3 text-sm">
        <div className="min-w-0">
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Legal entity</dt>
          <dd>
            <Link
              href={`/admin/legal-entities/${payout.legalEntityId}`}
              className="font-medium text-link underline"
            >
              View legal entity
            </Link>
          </dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Period</dt>
          <dd>
            {formatDate(payout.periodStart)} → {formatDate(payout.periodEnd)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Net</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {formatMoney(payout.netAmount, payout.currency)}
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
        {payout.stripeTransferId ? (
          <div>
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">
              Stripe transfer
            </dt>
            <dd className="text-on-surface">Transfer recorded</dd>
          </div>
        ) : null}
      </dl>

      <AdminTechnicalIdDisclosure
        items={[
          { label: "Payout ID", value: payout.id },
          { label: "Legal entity ID", value: payout.legalEntityId },
          { label: "Stripe transfer ID", value: payout.stripeTransferId },
        ]}
      />

      {payout.failureReason ? (
        <Alert variant="destructive">
          <AlertTitle>Stripe transfer issue</AlertTitle>
          <AlertDescription>{payout.failureReason}</AlertDescription>
        </Alert>
      ) : null}

      {payout.status === "clawback_pending" ? (
        <Alert variant="destructive">
          <AlertTitle>Manual reconciliation required</AlertTitle>
          <AlertDescription>
            Negative net — recover funds via reversal, offset, or direct repayment before closing.
          </AlertDescription>
        </Alert>
      ) : null}

      {payout.statementGenerationError ? (
        <Alert variant="destructive">
          <AlertTitle>Statement PDF unavailable</AlertTitle>
          <AlertDescription>{payout.statementGenerationError}</AlertDescription>
        </Alert>
      ) : null}

      <form action={addPayoutAdjustmentAction} className="space-y-3 rounded-md border p-3">
        <input type="hidden" name="payoutId" value={payout.id} />
        <h3 className="font-label text-sm font-semibold uppercase tracking-wide">Add adjustment</h3>
        <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
          <label className="block space-y-1 text-sm">
            <span>Amount</span>
            <input
              name="amount"
              required
              placeholder="-25.00"
              className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span>Note</span>
            <input
              name="note"
              required
              minLength={10}
              placeholder="Reason for adjustment"
              className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2"
            />
          </label>
        </div>
        <Button
          type="submit"
          variant="outline"
          disabled={adjustmentDisabled}
          className="rounded-md border border-outline-variant px-4 py-2 font-label text-sm font-semibold disabled:opacity-50 shadow-none"
        >
          Add adjustment
        </Button>
      </form>

      <PayoutMarkPaidButton
        payoutId={payout.id}
        stripeTransferId={payout.stripeTransferId ?? ""}
        disabled={adjustmentDisabled}
      />

      <AdminPayoutReverseButton payoutId={payout.id} status={payout.status} />
    </div>
  );
}
