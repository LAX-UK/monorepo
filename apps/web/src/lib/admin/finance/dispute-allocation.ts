import { disputeSellerSharePence } from "@auction/domain";
import type { DisputeDeskInvoice } from "@auction/types";

/** What each invoice carries, in pence, keyed by payment ID. */
export type DisputeShares = Readonly<Record<string, number>>;

/**
 * Splits the disputed amount over the invoices in proportion to their totals, never giving an
 * invoice more than it is worth. The pence left by rounding go to the largest invoices first, so
 * the shares always add up exactly.
 */
export function splitInProportion(
  invoices: readonly Pick<DisputeDeskInvoice, "paymentId" | "invoicePence">[],
  disputedPence: number,
): DisputeShares {
  const totalPence = invoices.reduce((sum, invoice) => sum + invoice.invoicePence, 0);
  if (totalPence <= 0 || disputedPence <= 0) {
    return Object.fromEntries(invoices.map((invoice) => [invoice.paymentId, 0]));
  }
  const shares = new Map<string, number>();
  let assigned = 0;
  for (const invoice of invoices) {
    const share = Math.min(
      invoice.invoicePence,
      Math.floor((disputedPence * invoice.invoicePence) / totalPence),
    );
    shares.set(invoice.paymentId, share);
    assigned += share;
  }
  const largestFirst = [...invoices].sort((a, b) => b.invoicePence - a.invoicePence);
  for (const invoice of largestFirst) {
    if (assigned >= disputedPence) break;
    const room = invoice.invoicePence - (shares.get(invoice.paymentId) ?? 0);
    const extra = Math.min(room, disputedPence - assigned);
    shares.set(invoice.paymentId, (shares.get(invoice.paymentId) ?? 0) + extra);
    assigned += extra;
  }
  return Object.fromEntries(shares);
}

export type ShareProblem = "negative" | "exceeds_invoice";

export type AllocationCheck = {
  allocatedPence: number;
  /** Positive while pence are left to allocate, negative when over-allocated. */
  remainingPence: number;
  /** Rows whose own share cannot be right, keyed by payment ID. */
  rowProblems: Readonly<Record<string, ShareProblem>>;
  /** True when the shares can be saved. */
  valid: boolean;
};

/** Checks the shares against the invoices and the disputed amount, as the API will. */
export function checkAllocation(
  invoices: readonly Pick<DisputeDeskInvoice, "paymentId" | "invoicePence">[],
  shares: DisputeShares,
  disputedPence: number,
): AllocationCheck {
  const rowProblems: Record<string, ShareProblem> = {};
  let allocatedPence = 0;
  for (const invoice of invoices) {
    const share = shares[invoice.paymentId] ?? 0;
    allocatedPence += share;
    if (share < 0) rowProblems[invoice.paymentId] = "negative";
    else if (share > invoice.invoicePence) rowProblems[invoice.paymentId] = "exceeds_invoice";
  }
  const remainingPence = disputedPence - allocatedPence;
  return {
    allocatedPence,
    remainingPence,
    rowProblems,
    valid: remainingPence === 0 && Object.keys(rowProblems).length === 0 && allocatedPence > 0,
  };
}

/** The lines to send: invoices that carry something. */
export function allocationLines(
  invoices: readonly Pick<DisputeDeskInvoice, "paymentId">[],
  shares: DisputeShares,
): { paymentId: string; amountPence: number }[] {
  return invoices
    .map((invoice) => ({
      paymentId: invoice.paymentId,
      amountPence: shares[invoice.paymentId] ?? 0,
    }))
    .filter((line) => line.amountPence > 0);
}

/** How much of `sharePence` on this invoice comes out of its seller's payout. */
export function sellerShareOf(
  invoice: Pick<DisputeDeskInvoice, "invoicePence" | "platformFeePence">,
  sharePence: number,
): number {
  return disputeSellerSharePence(sharePence, {
    amountPence: invoice.invoicePence,
    platformFeePence: invoice.platformFeePence,
  });
}

export type SellerEffect = {
  sellerId: string;
  sellerName: string;
  /** The part of the dispute that comes out of this seller's payout. */
  sellerSharePence: number;
};

export type AllocationEffects = {
  sellers: SellerEffect[];
  /** What the house bears: its fee's part of the dispute, and any rounding. */
  houseSharePence: number;
};

/**
 * What the shares do to payouts: each seller carries their net share of what falls on their
 * invoices, and the house bears the rest. Uses the same rule the API applies when it saves.
 */
export function allocationEffects(
  invoices: readonly DisputeDeskInvoice[],
  shares: DisputeShares,
): AllocationEffects {
  const bySeller = new Map<string, SellerEffect>();
  let total = 0;
  let sellerTotal = 0;
  for (const invoice of invoices) {
    const share = shares[invoice.paymentId] ?? 0;
    if (share <= 0) continue;
    const sellerSharePence = sellerShareOf(invoice, share);
    total += share;
    sellerTotal += sellerSharePence;
    const entry = bySeller.get(invoice.sellerId) ?? {
      sellerId: invoice.sellerId,
      sellerName: invoice.sellerName,
      sellerSharePence: 0,
    };
    entry.sellerSharePence += sellerSharePence;
    bySeller.set(invoice.sellerId, entry);
  }
  return { sellers: [...bySeller.values()], houseSharePence: total - sellerTotal };
}
