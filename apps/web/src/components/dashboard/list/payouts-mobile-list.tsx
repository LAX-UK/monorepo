"use client";

import {
  DashboardListRowCard,
  DashboardMobileList,
} from "@/components/dashboard/primitives/dashboard-list-row-card";
import { getPayoutStatusView } from "@/lib/presenters/payment-status";
import type { Payout } from "@auction/types";
import { Surface } from "@auction/ui/components/surface";

function formatMoney(amount: string, currency: string): string {
  const value = Number.parseFloat(amount);
  if (Number.isNaN(value)) return `${amount} ${currency}`;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(value);
}

type PayoutRowProps = {
  payout: Payout;
  sellerEntityId: string;
};

function PayoutRowCard({ payout, sellerEntityId }: PayoutRowProps) {
  const statusView = getPayoutStatusView(payout.status);
  const periodLabel = `${new Date(payout.periodStart).toLocaleDateString("en-GB")} → ${new Date(payout.periodEnd).toLocaleDateString("en-GB")}`;

  return (
    <DashboardListRowCard
      title={<span className="font-medium">{periodLabel}</span>}
      subtitle={
        <p className="text-xs tabular-nums text-on-surface-variant">
          Gross {formatMoney(payout.grossAmount, payout.currency)} · Fees{" "}
          {formatMoney(payout.platformFee, payout.currency)}
          {Number.parseFloat(payout.stripeFee) > 0
            ? ` + ${formatMoney(payout.stripeFee, payout.currency)} transfer`
            : ""}
        </p>
      }
      badges={
        <>
          <span className="text-base font-semibold tabular-nums text-on-surface">
            {formatMoney(payout.netAmount, payout.currency)}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusView.badgeClassName}`}
          >
            {statusView.label}
          </span>
        </>
      }
      footer={
        <a
          href={`/dashboard/legal-entities/${encodeURIComponent(sellerEntityId)}/payouts/${encodeURIComponent(payout.id)}/statement`}
          className="text-xs font-semibold text-primary underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Statement PDF
        </a>
      }
      footerIndented
    />
  );
}

type Props = {
  payouts: Payout[];
  sellerEntityId: string;
};

export function PayoutsMobileList({ payouts, sellerEntityId }: Props) {
  return (
    <DashboardMobileList>
      {payouts.map((payout) => (
        <li key={payout.id}>
          <PayoutRowCard payout={payout} sellerEntityId={sellerEntityId} />
        </li>
      ))}
    </DashboardMobileList>
  );
}

export function PayoutsDesktopList({ payouts, sellerEntityId }: Props) {
  return (
    <ul className="hidden space-y-3 lg:block">
      {payouts.map((p) => {
        const statusView = getPayoutStatusView(p.status);
        return (
          <li key={p.id}>
            <Surface
              variant="section"
              padding="md"
              interactive
              className="grid gap-3 text-sm sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
            >
              <div>
                <p className="font-medium">
                  {new Date(p.periodStart).toLocaleDateString("en-GB")} →{" "}
                  {new Date(p.periodEnd).toLocaleDateString("en-GB")}
                </p>
                <p className="text-xs tabular-nums text-on-surface-variant">
                  Gross {formatMoney(p.grossAmount, p.currency)} · Fees{" "}
                  {formatMoney(p.platformFee, p.currency)}
                  {Number.parseFloat(p.stripeFee) > 0
                    ? ` + ${formatMoney(p.stripeFee, p.currency)} transfer`
                    : ""}
                </p>
              </div>
              <div className="text-right text-base font-semibold tabular-nums text-on-surface">
                {formatMoney(p.netAmount, p.currency)}
              </div>
              <div className="flex items-center justify-end">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusView.badgeClassName}`}
                >
                  {statusView.label}
                </span>
              </div>
              <div className="flex justify-end sm:justify-center">
                <a
                  href={`/dashboard/legal-entities/${encodeURIComponent(sellerEntityId)}/payouts/${encodeURIComponent(p.id)}/statement`}
                  className="text-xs font-semibold text-primary underline underline-offset-2"
                >
                  Statement PDF
                </a>
              </div>
            </Surface>
          </li>
        );
      })}
    </ul>
  );
}
