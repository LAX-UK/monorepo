import "server-only";

import type { PaymentStatus, PayoutStatus } from "@auction/types";

export type AdminPaymentRow = {
  id: string;
  lotId: string;
  buyerId: string;
  sellerId: string;
  amount: string;
  platformFee: string;
  status: PaymentStatus;
  createdAt: Date;
  xeroInvoiceNumber: string | null;
  xeroOnlineInvoiceUrl: string | null;
  xeroSyncStatus: "pending_sync" | "synced" | "error" | null;
  xeroLastError: string | null;
};

export type AdminPayoutRow = {
  id: string;
  legalEntityId: string;
  periodStart: string;
  periodEnd: string;
  grossAmount: string;
  platformFee: string;
  stripeFee: string;
  netAmount: string;
  currency: string;
  status: PayoutStatus;
  stripeTransferId: string | null;
  xeroBillId: string | null;
  failureReason: string | null;
  processedAt: string | null;
  statementUrl: string | null;
  statementGenerationError: string | null;
  createdAt: string;
};

export function isPaymentStatus(s: string): s is PaymentStatus {
  return (
    s === "pending" ||
    s === "authorized" ||
    s === "captured" ||
    s === "refunded" ||
    s === "requires_manual_review"
  );
}

export function isPayoutStatus(s: unknown): s is PayoutStatus {
  return (
    s === "scheduled" ||
    s === "in_transit" ||
    s === "paid" ||
    s === "failed" ||
    s === "reversed" ||
    s === "clawback_pending"
  );
}

export function isXeroSyncStatus(s: unknown): s is NonNullable<AdminPaymentRow["xeroSyncStatus"]> {
  return s === "pending_sync" || s === "synced" || s === "error";
}

export function parseAdminPaymentRow(raw: unknown): AdminPaymentRow {
  const o = raw as Record<string, unknown>;
  const status = typeof o.status === "string" && isPaymentStatus(o.status) ? o.status : "pending";
  const lotId = o.lotId != null ? String(o.lotId) : String(o.auctionId ?? "");
  const xeroSync = o.xeroSyncStatus;
  return {
    id: String(o.id ?? ""),
    lotId,
    buyerId: String(o.buyerId ?? o.paidByUserId ?? ""),
    sellerId: String(o.sellerId ?? ""),
    amount: String(o.amount ?? "0"),
    platformFee: String(o.platformFee ?? "0"),
    status,
    createdAt: o.createdAt instanceof Date ? o.createdAt : new Date(String(o.createdAt ?? "")),
    xeroInvoiceNumber: o.xeroInvoiceNumber != null ? String(o.xeroInvoiceNumber) : null,
    xeroOnlineInvoiceUrl: o.xeroOnlineInvoiceUrl != null ? String(o.xeroOnlineInvoiceUrl) : null,
    xeroSyncStatus: isXeroSyncStatus(xeroSync) ? xeroSync : null,
    xeroLastError: o.xeroLastError != null ? String(o.xeroLastError) : null,
  };
}

export function parseAdminPayoutRow(raw: unknown): AdminPayoutRow {
  const o = raw as Record<string, unknown>;
  return {
    id: String(o.id ?? ""),
    legalEntityId: String(o.legalEntityId ?? ""),
    periodStart: String(o.periodStart ?? ""),
    periodEnd: String(o.periodEnd ?? ""),
    grossAmount: String(o.grossAmount ?? "0.00"),
    platformFee: String(o.platformFee ?? "0.00"),
    stripeFee: String(o.stripeFee ?? "0.00"),
    netAmount: String(o.netAmount ?? "0.00"),
    currency: String(o.currency ?? "GBP"),
    status: isPayoutStatus(o.status) ? o.status : "scheduled",
    stripeTransferId: o.stripeTransferId == null ? null : String(o.stripeTransferId),
    xeroBillId: o.xeroBillId == null ? null : String(o.xeroBillId),
    failureReason: o.failureReason == null ? null : String(o.failureReason),
    processedAt: o.processedAt == null ? null : String(o.processedAt),
    statementUrl: o.statementUrl == null ? null : String(o.statementUrl),
    statementGenerationError:
      o.statementGenerationError == null ? null : String(o.statementGenerationError),
    createdAt: String(o.createdAt ?? ""),
  };
}
