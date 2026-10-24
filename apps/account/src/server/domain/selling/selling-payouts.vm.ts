import type {
  PortalPayeeConnectStatus,
  PortalPayeeConnectSurface,
  PortalPayout,
  PortalSaleStatement,
} from "@auction/shop-contracts";
import type { PayoutAccountRead } from "../../ports/selling-gateway";
import { type PayoutStatusVm, describePayoutStatus } from "./selling-payout-status";

export type PayoutAccountStage = "not_set_up" | "action_needed" | "ready" | "not_offered";

export type PayoutAccountVm = {
  stage: PayoutAccountStage;
  statusLabel: string;
  tone: "neutral" | "warning" | "success";
  title: string;
  description: string;
  /** What the button opens in Stripe's setup; null when there is nothing to open. */
  action: { label: string; surface: PortalPayeeConnectSurface } | null;
  publishableKey: string | null;
};

/**
 * The bank account LAX pays sales into, as one status card. Setup runs in Stripe's own forms
 * inside the page; when Stripe is not configured for this environment nothing can be opened.
 */
export function buildPayoutAccount(read: PayoutAccountRead): PayoutAccountVm {
  const publishableKey = read.config.connectConfigured ? read.config.publishableKey : null;
  if (!publishableKey) {
    return {
      stage: "not_offered",
      statusLabel: "Not available yet",
      tone: "neutral",
      title: "Bank details for payouts",
      description:
        "Adding bank details isn't open yet. Payouts due to you are kept safe until it is.",
      action: null,
      publishableKey: null,
    };
  }
  return { ...describeStage(read.status), publishableKey };
}

function describeStage(status: PortalPayeeConnectStatus): Omit<PayoutAccountVm, "publishableKey"> {
  if (!status.stripeAccountId) {
    return {
      stage: "not_set_up",
      statusLabel: "Not set up",
      tone: "neutral",
      title: "Set up payouts",
      description:
        "Add your details and bank account once to be paid for sales on LAX Shop and lax.art. It takes about five minutes.",
      action: { label: "Set up payouts", surface: "onboarding" },
    };
  }
  if (!status.ready) {
    return {
      stage: "action_needed",
      statusLabel: "Action needed",
      tone: "warning",
      title: "Finish setting up payouts",
      description: status.disabledReason
        ? "Payouts are paused until a few details are updated."
        : "A few details are still needed before LAX can pay you.",
      action: { label: "Continue setup", surface: "onboarding" },
    };
  }
  return {
    stage: "ready",
    statusLabel: "Ready",
    tone: "success",
    title: "Payouts are set up",
    description: "LAX pays each sale into this bank account once its refund period has ended.",
    action: { label: "Manage bank details", surface: "management" },
  };
}

export type PayoutRowVm = {
  payoutId: string;
  /** What the payout is for: "Harbour Print · Edition 12", or "Payout" when the sale is unknown. */
  title: string;
  netPence: number;
  grossPence: number;
  feesPence: number;
  status: PayoutStatusVm;
};

export type PayoutsListVm = {
  rows: PayoutRowVm[];
  totals: { paidPence: number; toComePence: number };
};

/** Names a payout by the sale it pays for; Shop pays each sold edition on its own. */
function payoutTitle(sale: PortalSaleStatement | undefined): string {
  if (!sale) return "Payout";
  return sale.editionNumber != null
    ? `${sale.artworkTitle} · Edition ${sale.editionNumber}`
    : sale.artworkTitle;
}

export function buildPayoutsList(
  payouts: readonly PortalPayout[],
  sales: readonly PortalSaleStatement[] = [],
): PayoutsListVm {
  const saleByPayout = new Map(sales.map((sale) => [sale.payoutId, sale]));
  const rows = [...payouts]
    .sort((a, b) => ((a.paidAt ?? a.payoutDueAt) < (b.paidAt ?? b.payoutDueAt) ? 1 : -1))
    .map((payout) => ({
      payoutId: payout.payoutId,
      title: payoutTitle(saleByPayout.get(payout.payoutId)),
      netPence: payout.netPence,
      grossPence: payout.grossPence,
      feesPence: payout.deductionsPence,
      status: describePayoutStatus(payout.status, payout),
    }));
  const totals = { paidPence: 0, toComePence: 0 };
  for (const row of rows) {
    if (row.status.stage === "paid") totals.paidPence += row.netPence;
    if (row.status.stage === "to_come") totals.toComePence += row.netPence;
  }
  return { rows, totals };
}
