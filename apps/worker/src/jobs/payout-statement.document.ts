import { legalEntityFor } from "@auction/branding";
import { LONDON_TIME_ZONE, formatWhen } from "@auction/datetime";
import {
  SELLER_PAYOUT_NOTE,
  notVatRegisteredLine,
  parseMoneyToMinorUnits,
  payoutLineBreakdown,
  ratePercentLabel,
} from "@auction/domain";
import type {
  PayoutStatementLineRow,
  PayoutStatementPayoutRow,
} from "../interfaces/payout-statement.repository.js";

/** One row of the statement's table: a sale split as the seller's agreement splits it. */
export type StatementRow = {
  work: string;
  lot: string;
  hammer: string;
  /** "−£12,300.00 (15%)". */
  commission: string;
  /** "−£2,460.00 (20%)", "No VAT", or "—" on a sale paid before VAT was set apart. */
  vat: string;
  receive: string;
};

/** What the statement's table and totals say, already worded and formatted. */
export type StatementDocument = {
  rows: StatementRow[];
  totals: StatementRow;
  /** The lines under the table: how commission works, and VAT when none is charged. */
  notes: string[];
  /** "Thu 12 Nov, 04:49 GMT", or `null` while the payout has not been sent. */
  paidOut: string | null;
};

/** The one minus sign the money formatter uses (U+2212); the statement embeds a font that has it. */
const MINUS = "\u2212";
const DASH = "—";

/**
 * How a lot sold, in the seller's words. A seller is never told who bought: LAX pays the seller
 * itself, so the buyer's identity is not needed to complete the sale.
 */
export function soldPhrase(line: Pick<PayoutStatementLineRow, "soldAfterAuction">): string {
  return line.soldAfterAuction ? "sold after the auction to the next bidder" : "sold at auction";
}

function money(pence: number, currency: string): string {
  const formatted = new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(
    Math.abs(pence) / 100,
  );
  return pence < 0 ? `${MINUS}${formatted}` : formatted;
}

/** An amount as the statement prints it, a negative one with the minus sign: "−£50.00". */
export function statementMoney(amount: string, currency: string): string {
  return money(Number(parseMoneyToMinorUnits(amount)), currency);
}

const deduction = (pence: number, currency: string) =>
  pence === 0 ? money(0, currency) : money(-Math.abs(pence), currency);
const pence = (amount: string) => Number(parseMoneyToMinorUnits(amount));

type Split = { hammer: number; commission: number; vat: number; receive: number };

/** A row and its figures in pence, so the totals are the sums of the rows. */
type Built = { row: StatementRow; split: Split; noVat: boolean };

function otherWork(line: PayoutStatementLineRow): string {
  if (line.dealReference) return `Private sale ${line.dealReference}`;
  const label: Record<string, string> = {
    refund: "Refund to a buyer",
    dispute: "Payment disputed by a buyer",
    chargeback: "Payment reversed by a buyer's bank",
    platform_credit: "Credit from LAX",
    adjustment: "Adjustment",
    reversal: "Payout reversed",
  };
  const kind = label[line.kind] ?? "Adjustment";
  return line.note ? `${kind}: ${line.note}` : kind;
}

function buildRow(line: PayoutStatementLineRow, currency: string): Built {
  const lot = line.lotNumber != null ? `Lot ${line.lotNumber}` : "";
  const work = line.lotTitle ? `${line.lotTitle} (${soldPhrase(line)})` : otherWork(line);
  const terms = line.sellerTerms;
  if (terms) {
    const noVat = terms.vatTreatment === "not_registered";
    return {
      row: {
        work,
        lot,
        hammer: money(terms.hammerPence, currency),
        commission: `${deduction(terms.commissionPence, currency)} (${ratePercentLabel(terms.commissionBps)})`,
        vat: noVat
          ? "No VAT"
          : `${deduction(terms.vatPence, currency)} (${ratePercentLabel(terms.vatBps)})`,
        receive: money(terms.netPence, currency),
      },
      split: {
        hammer: terms.hammerPence,
        commission: terms.commissionPence,
        vat: terms.vatPence,
        receive: terms.netPence,
      },
      noVat,
    };
  }
  const recorded = payoutLineBreakdown({
    kind: line.kind,
    amount: String(line.amount),
    payment:
      line.paymentAmount !== null && line.paymentPlatformFee !== null
        ? { amount: String(line.paymentAmount), platformFee: String(line.paymentPlatformFee) }
        : null,
  });
  if (recorded) {
    // Paid under the old rule: the lot's real hammer beside the fee and amount recorded.
    const hammer = pence(line.lotHammerPrice ?? recorded.gross);
    const split = {
      hammer,
      commission: pence(recorded.commissionAndFees),
      vat: 0,
      receive: pence(recorded.net),
    };
    return {
      row: {
        work,
        lot,
        hammer: money(hammer, currency),
        commission: deduction(split.commission, currency),
        vat: DASH,
        receive: money(split.receive, currency),
      },
      split,
      noVat: false,
    };
  }
  const amount = pence(String(line.amount));
  return {
    row: { work, lot, hammer: "", commission: "", vat: "", receive: money(amount, currency) },
    split: { hammer: 0, commission: 0, vat: 0, receive: amount },
    noVat: false,
  };
}

/**
 * The seller's statement for a payout: each sale with its hammer, the commission and the VAT on
 * it at their rates, and what the seller receives, from the snapshot each sale was paid on (or,
 * for a payout made before snapshots, what was recorded). The totals are the sums of the rows; a
 * transfer fee, when one was charged, is a row of its own so the rows add up to the payout.
 */
export function payoutStatementDocument(input: {
  payout: Pick<PayoutStatementPayoutRow, "currency" | "stripeFee" | "processedAt">;
  lines: readonly PayoutStatementLineRow[];
  /** When the statement is made, for the date style's year. */
  now: Date;
}): StatementDocument {
  const { currency } = input.payout;
  const built = input.lines.map((line) => buildRow(line, currency));
  const fee = pence(input.payout.stripeFee || "0");
  if (fee !== 0) {
    built.push({
      row: {
        work: "Transfer fee",
        lot: "",
        hammer: "",
        commission: "",
        vat: "",
        receive: money(-fee, currency),
      },
      split: { hammer: 0, commission: 0, vat: 0, receive: -fee },
      noVat: false,
    });
  }
  const sum = built.reduce(
    (total, { split }) => ({
      hammer: total.hammer + split.hammer,
      commission: total.commission + split.commission,
      vat: total.vat + split.vat,
      receive: total.receive + split.receive,
    }),
    { hammer: 0, commission: 0, vat: 0, receive: 0 },
  );
  const notes = [SELLER_PAYOUT_NOTE];
  if (built.some((entry) => entry.noVat)) {
    notes.push(notVatRegisteredLine(legalEntityFor("bid").name));
  }
  return {
    rows: built.map((entry) => entry.row),
    totals: {
      work: "Total",
      lot: "",
      hammer: money(sum.hammer, currency),
      commission: deduction(sum.commission, currency),
      vat: deduction(sum.vat, currency),
      receive: money(sum.receive, currency),
    },
    notes,
    paidOut: input.payout.processedAt
      ? formatWhen(input.payout.processedAt, LONDON_TIME_ZONE, input.now)
      : null,
  };
}
