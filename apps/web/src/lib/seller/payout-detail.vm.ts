import type { PayoutDetail, PayoutLine } from "@/lib/data/http/workspace-selling.schema";
import { formatMoney } from "@/lib/format-currency";
import { formatDeduction } from "@/lib/money/currency";
import { LONDON_TIME_ZONE, formatMoment } from "@auction/datetime";
import {
  formatPayoutReference,
  minorUnitsToMoneyString,
  parseMoneyToMinorUnits,
} from "@auction/domain";
import type { PayoutStatus } from "@auction/types";
import { payoutStatuses } from "@auction/types";
import {
  SELLER_COMMISSION_COPY,
  type SellerSaleFiguresVm,
  recordedSaleFigures,
  snapshotSaleFigures,
} from "./seller-commission.vm";
import { PAYOUT_STATUS_BADGE } from "./sold-and-payouts-list";

/** Lines other than sales, in the seller's words. */
const LINE_KIND_LABEL: Record<string, string> = {
  refund: "Refund to a buyer",
  dispute: "Payment disputed by a buyer",
  chargeback: "Payment reversed by a buyer's bank",
  platform_credit: "Credit from LAX",
  adjustment: "Adjustment",
  reversal: "Payout reversed",
};

export type PayoutLineVm = {
  id: string;
  work: string;
  lot: string | null;
  /** A sale's split: the hammer, the commission and VAT on it, at their rates. `null` otherwise. */
  sale: SellerSaleFiguresVm | null;
  receive: string;
  note: string | null;
};

export type PayoutTotalsVm = {
  hammer: string;
  commission: string;
  vat: string;
  /** The commission and the VAT on it together, as the summary shows them. */
  charges: string;
  /** Every line added up: what the payout pays. */
  receive: string;
};

export type PayoutDetailVm = {
  title: string;
  subtitle: string;
  status: (typeof PAYOUT_STATUS_BADGE)[PayoutStatus];
  statusNote: string | null;
  lines: PayoutLineVm[];
  /** The sums of the lines' columns. */
  totals: PayoutTotalsVm;
  /** What the seller reads under the lines: how commission works, and VAT when none is charged. */
  notes: string[];
  statementHref: string;
};

/** Said once, in the same words on the sold list, the payout and the statement. */
export const SOLD_AFTER_AUCTION_LINE = "Sold after the auction to the next bidder";

/** The payment processor's fee on the payout, as its own line so the lines add up to it. */
const TRANSFER_FEE_LINE = "Transfer fee";

const pence = (amount: string) => Number(parseMoneyToMinorUnits(amount));

function saleFigures(row: PayoutLine, currency: string): SellerSaleFiguresVm | null {
  if (row.sellerTerms) return snapshotSaleFigures(row.sellerTerms, currency);
  if (!row.breakdown) return null;
  // Paid under the old rule: the lot's real hammer, never the buyer's payment, beside the
  // fee and the amount that were recorded.
  return recordedSaleFigures(
    {
      hammer: row.lot?.hammerPrice ?? row.breakdown.gross,
      commissionAndFees: row.breakdown.commissionAndFees,
      net: row.breakdown.net,
    },
    currency,
  );
}

function line(row: PayoutLine, currency: string): PayoutLineVm & { receivePence: number } {
  const lot = row.lot?.lotNumber == null ? null : `Lot ${row.lot.lotNumber}`;
  const sale = saleFigures(row, currency);
  if (sale) {
    return {
      id: row.id,
      work: row.lot?.title ?? "Sale",
      lot,
      sale,
      receive: sale.receive,
      receivePence: sale.pence.receive,
      note:
        row.note ??
        (row.soldAfterAuction
          ? SOLD_AFTER_AUCTION_LINE
          : sale.recorded
            ? SELLER_COMMISSION_COPY.recorded
            : null),
    };
  }
  return {
    id: row.id,
    work: LINE_KIND_LABEL[row.kind] ?? "Adjustment",
    lot,
    sale: null,
    receive: formatMoney(row.amount, currency),
    receivePence: pence(row.amount),
    note: row.note,
  };
}

/**
 * Each line of a payout, with the totals as the sums of its columns. A transfer fee, when the
 * payment processor charged one, is a line of its own, so the lines add up to what is paid.
 */
export function payoutLinesVm(
  detail: Pick<PayoutDetail, "lines" | "stripeFee" | "currency">,
): Pick<PayoutDetailVm, "lines" | "totals" | "notes"> {
  const { currency } = detail;
  const rows = detail.lines.map((row) => line(row, currency));
  const fee = pence(detail.stripeFee || "0");
  if (fee !== 0) {
    rows.push({
      id: "transfer-fee",
      work: TRANSFER_FEE_LINE,
      lot: null,
      sale: null,
      receive: formatDeduction(minorUnitsToMoneyString(BigInt(fee)), currency),
      receivePence: -fee,
      note: null,
    });
  }
  const sum = { hammer: 0, commission: 0, vat: 0, receive: 0 };
  for (const row of rows) {
    sum.receive += row.receivePence;
    if (!row.sale) continue;
    sum.hammer += row.sale.pence.hammer;
    sum.commission += row.sale.pence.commission;
    sum.vat += row.sale.pence.vat;
  }
  const money = (p: number) => formatMoney(minorUnitsToMoneyString(BigInt(p)), currency);
  const sales = rows.flatMap((row) => (row.sale ? [row.sale] : []));
  const notes: string[] = [SELLER_COMMISSION_COPY.payoutNote];
  if (sales.some((sale) => sale.noVat)) notes.push(SELLER_COMMISSION_COPY.noVat);
  return {
    lines: rows.map(({ receivePence: _, ...row }) => row),
    totals: {
      hammer: money(sum.hammer),
      commission: formatDeduction(minorUnitsToMoneyString(BigInt(sum.commission)), currency),
      vat: formatDeduction(minorUnitsToMoneyString(BigInt(sum.vat)), currency),
      charges: money(sum.commission + sum.vat),
      receive: money(sum.receive),
    },
    notes,
  };
}

function isPayoutStatus(status: string): status is PayoutStatus {
  return (payoutStatuses as readonly string[]).includes(status);
}

/** One payout as its page reads: the amount, where it is, and each lot with its split. */
export function payoutDetailVm(
  detail: PayoutDetail,
  input: { sellerEntityId: string; now: Date },
): PayoutDetailVm {
  const status = PAYOUT_STATUS_BADGE[isPayoutStatus(detail.status) ? detail.status : "scheduled"];
  const money = (amount: string) => formatMoney(amount, detail.currency);
  const sent = detail.processedAt
    ? formatMoment(detail.processedAt, LONDON_TIME_ZONE, input.now, {
        time: false,
        inSentence: true,
      })
    : null;
  const period = `${formatMoment(detail.periodStart, LONDON_TIME_ZONE, input.now, { time: false })} to ${formatMoment(detail.periodEnd, LONDON_TIME_ZONE, input.now, { time: false })}`;
  const statusNote =
    detail.status === "in_transit" && sent
      ? `Sent ${sent}, usually 2 working days`
      : detail.status === "paid" && sent
        ? `Arrived ${sent}`
        : detail.status === "scheduled"
          ? "Sent at the end of the period"
          : null;
  return {
    title: `Payout of ${money(detail.netAmount)}`,
    subtitle: `Sales ${period} · reference ${formatPayoutReference(detail)}`,
    status,
    statusNote,
    ...payoutLinesVm(detail),
    statementHref: `/legal-entities/${encodeURIComponent(input.sellerEntityId)}/payouts/${encodeURIComponent(detail.id)}/statement`,
  };
}
