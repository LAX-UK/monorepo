import type { OldRuleRowDto } from "@/lib/data/http/admin-seller-proceeds.shared";
import {
  formatBpsAsPercent,
  formatStaffDate,
  formatStaffExportDate,
  formatStaffMoney,
} from "@auction/staff-ui";
import { lotName } from "./held-reasons";
import { poundsToPence } from "./pounds";

export const OLD_RULE_NOTICE =
  "Paid before seller payouts followed the signed agreement. Each row compares what the seller was paid with what their agreement gives. Nothing here changes a payout. Finance decides each one and marks it reviewed.";

export const OLD_RULE_EMPTY = "No payouts were paid under the old rule";

const UNPRICED: Record<
  Extract<OldRuleRowDto["agreementGives"], { kind: "unpriced" }>["reason"],
  string
> = {
  no_hammer: "No hammer on the invoice",
  no_agreement: "No signed agreement",
  no_commission: "The agreement has no commission",
  vat_setting_missing: "VAT setting missing",
  negative_net: "Deductions are more than the hammer",
};

export type OldRuleRow = {
  id: string;
  payoutId: string;
  paidOn: string;
  seller: string;
  lot: string;
  lotTitle: string;
  lotHref: string;
  hammer: string;
  paid: string;
  /** "Commission 12%" or why no figure can be given. */
  agreementRate: string;
  agreementGives: string | null;
  /** Signed: what the agreement gives less what was paid. */
  difference: string | null;
  agreementReference: string | null;
};

function signed(pence: number): string {
  if (pence > 0) return `+${formatStaffMoney(pence)}`;
  return formatStaffMoney(pence);
}

export function buildOldRuleRow(row: OldRuleRowDto, now: Date = new Date()): OldRuleRow {
  const gives = row.agreementGives;
  return {
    id: row.lineId,
    payoutId: row.payoutId,
    paidOn: formatStaffDate(row.paidAt ?? row.payoutCreatedAt, now),
    seller: row.sellerName ?? "Unknown seller",
    lot: lotName(row),
    lotTitle: row.lotTitle,
    lotHref: `/admin/lots/${encodeURIComponent(row.lotId)}`,
    hammer: row.hammerPence === null ? "" : formatStaffMoney(row.hammerPence),
    paid: formatStaffMoney(row.paidNetPence),
    agreementRate:
      gives.kind === "priced"
        ? `Commission ${formatBpsAsPercent(gives.commissionBps)}`
        : UNPRICED[gives.reason],
    agreementGives: gives.kind === "priced" ? formatStaffMoney(gives.netPence) : null,
    difference: row.differencePence === null ? null : signed(row.differencePence),
    agreementReference: row.agreement?.reference ?? null,
  };
}

/** Columns of the downloaded review, in the order finance reads them. */
export const OLD_RULE_CSV_COLUMNS = [
  { key: "paidOn", header: "Paid on" },
  { key: "seller", header: "Seller" },
  { key: "lot", header: "Lot" },
  { key: "title", header: "Title" },
  { key: "agreement", header: "Agreement" },
  { key: "hammer", header: "Hammer" },
  { key: "buyerPaid", header: "Buyer paid" },
  { key: "oldFee", header: "Old fee" },
  { key: "sellerPaid", header: "Seller was paid" },
  { key: "agreementGives", header: "Agreement gives" },
  { key: "difference", header: "Difference" },
] as const;

export type OldRuleCsvKey = (typeof OLD_RULE_CSV_COLUMNS)[number]["key"];

const pounds = (pence: number) => (pence / 100).toFixed(2);

/** One row of the CSV: plain figures in pounds, dates that do not move with the clock. */
export function oldRuleCsvRow(row: OldRuleRowDto): Record<OldRuleCsvKey, string> {
  const gives = row.agreementGives;
  return {
    paidOn: formatStaffExportDate(row.paidAt ?? row.payoutCreatedAt),
    seller: row.sellerName ?? "",
    lot: row.lotNumber === null ? "" : String(row.lotNumber),
    title: row.lotTitle,
    agreement: row.agreement?.reference ?? "",
    hammer: row.hammerPence === null ? "" : pounds(row.hammerPence),
    buyerPaid: pounds(poundsToPence(row.paymentAmount)),
    oldFee: pounds(poundsToPence(row.platformFee)),
    sellerPaid: pounds(row.paidNetPence),
    agreementGives: gives.kind === "priced" ? pounds(gives.netPence) : UNPRICED[gives.reason],
    difference: row.differencePence === null ? "" : pounds(row.differencePence),
  };
}
