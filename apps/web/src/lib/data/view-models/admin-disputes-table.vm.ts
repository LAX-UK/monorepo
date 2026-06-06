import type { AdminDisputeCaseRow, DisputeCaseStatus } from "@auction/types";

export type AdminDisputeTableRow = {
  stripeDisputeId: string;
  paymentId: string;
  status: DisputeCaseStatus;
  amountLabel: string;
  currency: string;
  reason: string | null;
  reasonLabel: string;
  sellerLegalEntityId: string;
  sellerDisplayName: string | null;
  openedAt: Date;
  closedAt: Date | null;
  outcome: AdminDisputeCaseRow["outcome"];
  lotId: string | null;
  lotTitle: string | null;
  buyerId: string | null;
  buyerLabel: string | null;
  timelineEvents: AdminDisputeCaseRow["timelineEvents"];
};

const REASON_LABELS: Record<string, string> = {
  fraudulent: "Fraudulent",
  duplicate: "Duplicate",
  product_not_received: "Product not received",
  product_unacceptable: "Product unacceptable",
  subscription_canceled: "Subscription canceled",
  unrecognized: "Unrecognized",
  credit_not_processed: "Credit not processed",
  general: "General",
  bank_cannot_process: "Bank cannot process",
  debit_not_authorized: "Debit not authorized",
  incorrect_account_details: "Incorrect account details",
  insufficient_funds: "Insufficient funds",
};

function formatMoneyFromCents(amountCents: number, currency: string): string {
  const amount = amountCents / 100;
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function reasonLabel(reason: string | null): string {
  if (!reason) return "—";
  return REASON_LABELS[reason] ?? reason.replaceAll("_", " ");
}

export function buildAdminDisputeTableRow(row: AdminDisputeCaseRow): AdminDisputeTableRow {
  return {
    stripeDisputeId: row.stripeDisputeId,
    paymentId: row.paymentId,
    status: row.status,
    amountLabel: formatMoneyFromCents(row.amountCents, row.currency),
    currency: row.currency,
    reason: row.reason,
    reasonLabel: reasonLabel(row.reason),
    sellerLegalEntityId: row.sellerLegalEntityId,
    sellerDisplayName: row.sellerDisplayName ?? null,
    openedAt: new Date(row.openedAt),
    closedAt: row.closedAt ? new Date(row.closedAt) : null,
    outcome: row.outcome,
    lotId: row.lotId ?? null,
    lotTitle: row.lotTitle ?? null,
    buyerId: row.buyerId ?? null,
    buyerLabel: row.buyerLabel ?? null,
    timelineEvents: row.timelineEvents ?? [],
  };
}

export function buildAdminDisputeTableRows(
  rows: readonly AdminDisputeCaseRow[],
): AdminDisputeTableRow[] {
  return rows.map(buildAdminDisputeTableRow);
}
