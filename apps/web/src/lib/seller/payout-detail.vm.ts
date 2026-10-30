import { formatLotMoment } from "@/lib/bid/lot-moment";
import type { PayoutDetail, PayoutLine } from "@/lib/data/http/workspace-selling.schema";
import { formatMoney } from "@/lib/format-currency";
import { addMoneyStrings } from "@auction/domain";
import type { PayoutStatus } from "@auction/types";
import { payoutStatuses } from "@auction/types";
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
  /** Sales split into hammer, LAX's commission and fees, and what the seller receives. */
  hammer: string | null;
  fees: string | null;
  receive: string;
  note: string | null;
};

export type PayoutDetailVm = {
  title: string;
  subtitle: string;
  status: (typeof PAYOUT_STATUS_BADGE)[PayoutStatus];
  statusNote: string | null;
  gross: string;
  fees: string;
  lines: PayoutLineVm[];
  total: string;
  statementHref: string;
};

function line(row: PayoutLine, currency: string): PayoutLineVm {
  const money = (amount: string) => formatMoney(amount, currency);
  if (row.breakdown) {
    return {
      id: row.id,
      work: row.lot?.title ?? "Sale",
      lot: row.lot?.lotNumber == null ? null : `Lot ${row.lot.lotNumber}`,
      hammer: money(row.breakdown.gross),
      fees: money(`-${row.breakdown.commissionAndFees}`),
      receive: money(row.breakdown.net),
      note: row.note,
    };
  }
  return {
    id: row.id,
    work: LINE_KIND_LABEL[row.kind] ?? "Adjustment",
    lot: row.lot?.lotNumber == null ? null : `Lot ${row.lot.lotNumber}`,
    hammer: null,
    fees: null,
    receive: money(row.amount),
    note: row.note,
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
  // Mid-sentence, "Yesterday" reads "sent yesterday".
  const sent = detail.processedAt
    ? formatLotMoment(detail.processedAt, input.now, { time: false }).replace(
        /^(Today|Yesterday|Tomorrow)/,
        (word) => word.toLowerCase(),
      )
    : null;
  const period = `${formatLotMoment(detail.periodStart, input.now, { time: false })} to ${formatLotMoment(detail.periodEnd, input.now, { time: false })}`;
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
    subtitle: `Sales ${period} · reference ${detail.id.slice(0, 8).toUpperCase()}`,
    status,
    statusNote,
    gross: money(detail.grossAmount),
    fees: money(addMoneyStrings(detail.platformFee, detail.stripeFee || "0")),
    lines: detail.lines.map((row) => line(row, detail.currency)),
    total: money(detail.netAmount),
    statementHref: `/legal-entities/${encodeURIComponent(input.sellerEntityId)}/payouts/${encodeURIComponent(detail.id)}/statement`,
  };
}
