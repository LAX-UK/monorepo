import type { SellerTermsFiguresView, SoldLot } from "@/lib/data/http/workspace-selling.schema";
import { formatMoney } from "@/lib/format-currency";
import { formatDeduction } from "@/lib/money/currency";
import { legalEntityFor } from "@auction/branding";
import {
  SELLER_PAYOUT_NOTE,
  minorUnitsToMoneyString,
  notVatRegisteredLine,
  parseMoneyToMinorUnits,
  ratePercentLabel,
} from "@auction/domain";

/**
 * The seller's words for their commission, said the same way on Sold & payouts, the payout, the
 * statement, the agreement and a re-offer request. Every figure comes from the sale's
 * seller-terms snapshot (or, for a payout made before snapshots, from what was recorded): this
 * module formats figures, it never works one out.
 */
export const SELLER_COMMISSION_COPY = {
  hammer: "hammer",
  youReceive: "you receive",
  afterPayment: "After payment",
  beingConfirmed: "Being confirmed",
  soldNote:
    '"You receive" is the hammer less your commission and the VAT on it, as set in your signed agreement.',
  payoutNote: SELLER_PAYOUT_NOTE,
  noVat: notVatRegisteredLine(legalEntityFor("bid").name),
  /** A payout line paid before commission and VAT were set apart. */
  recorded: "Paid before commission and VAT were shown apart: the figures as recorded.",
} as const;

const money = (pence: number, currency: string) =>
  formatMoney(minorUnitsToMoneyString(BigInt(pence)), currency);
const deduction = (pence: number, currency: string) =>
  formatDeduction(minorUnitsToMoneyString(BigInt(pence)), currency);

/** A charge with its rate: "−£12,300.00" at "15%". */
export type SellerChargeVm = { amount: string; rate: string | null };

/** One sale split the way the seller's agreement splits it, ready to show. */
export type SellerSaleFiguresVm = {
  hammer: string;
  commission: SellerChargeVm;
  /** `null` on a sale paid before VAT on commission was set apart: it is inside the commission. */
  vat: SellerChargeVm | null;
  receive: string;
  /** No VAT was charged: the Bid company was not VAT-registered when the sale was priced. */
  noVat: boolean;
  /** Paid under the old rule: the figures are as recorded, not from a snapshot. */
  recorded: boolean;
  /** The same figures in pence, for totals that are the sum of the lines. */
  pence: { hammer: number; commission: number; vat: number; receive: number };
};

/** A sale paid from its snapshot: the snapshot's own figures and rates. */
export function snapshotSaleFigures(
  terms: SellerTermsFiguresView,
  currency: string,
): SellerSaleFiguresVm {
  const noVat = terms.vatTreatment === "not_registered";
  return {
    hammer: money(terms.hammerPence, currency),
    commission: {
      amount: deduction(terms.commissionPence, currency),
      rate: ratePercentLabel(terms.commissionBps),
    },
    vat: {
      amount: deduction(terms.vatPence, currency),
      rate: noVat ? null : ratePercentLabel(terms.vatBps),
    },
    receive: money(terms.netPence, currency),
    noVat,
    recorded: false,
    pence: {
      hammer: terms.hammerPence,
      commission: terms.commissionPence,
      vat: terms.vatPence,
      receive: terms.netPence,
    },
  };
}

const toPence = (amount: string) => Number(parseMoneyToMinorUnits(amount));

/**
 * A sale paid under the old rule, before snapshots: the lot's real hammer beside what was
 * recorded (the fee taken and what was paid), with no rate or VAT to show.
 */
export function recordedSaleFigures(
  input: { hammer: string; commissionAndFees: string; net: string },
  currency: string,
): SellerSaleFiguresVm {
  const pence = {
    hammer: toPence(input.hammer),
    commission: toPence(input.commissionAndFees),
    vat: 0,
    receive: toPence(input.net),
  };
  return {
    hammer: money(pence.hammer, currency),
    commission: { amount: deduction(pence.commission, currency), rate: null },
    vat: null,
    receive: money(pence.receive, currency),
    noVat: false,
    recorded: true,
    pence,
  };
}

/** A sold lot's "you receive" figure: the amount once known, else where it stands, in words. */
export type ReceiveFigureVm = { value: string; pending: boolean };

/**
 * What the seller receives for a sold lot. Before the buyer pays it is "After payment"; once paid,
 * the snapshot's figure, or "Being confirmed" while the sale cannot be priced yet. A sale refunded
 * to its buyer before payout pays the seller nothing.
 */
export function soldReceiveFigure(lot: Pick<SoldLot, "net" | "stage">): ReceiveFigureVm {
  if (lot.net !== null) return { value: formatMoney(lot.net, "GBP"), pending: false };
  if (lot.stage === "buyer_paying") {
    return { value: SELLER_COMMISSION_COPY.afterPayment, pending: true };
  }
  if (lot.stage === "refunded") return { value: formatMoney(0, "GBP"), pending: false };
  return { value: SELLER_COMMISSION_COPY.beingConfirmed, pending: true };
}

/**
 * The line a seller agrees to on a re-offer request, from the figures stored when the request
 * was made: "You receive £62,320.00: the offer of £76,000.00 less your 15% commission and VAT,
 * under your signed agreement."
 */
export function reofferConsentLine(input: {
  offerMinor: number;
  proceedsMinor: number;
  commissionBps: number | null;
}): string {
  const rate = input.commissionBps === null ? "" : ` ${ratePercentLabel(input.commissionBps)}`;
  return `You receive ${money(input.proceedsMinor, "GBP")}: the offer of ${money(input.offerMinor, "GBP")} less your${rate} commission and VAT, under your signed agreement.`;
}
