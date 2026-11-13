import type { AdminSettlementPreview } from "@/lib/data/http/admin-payouts.shared";
import type {
  SellerAgreementRef,
  SettlementPreviewSaleDto,
  SettlementPreviewTotalsDto,
} from "@/lib/data/http/admin-seller-proceeds.shared";
import { formatBpsAsPercent, formatStaffMoney } from "@auction/staff-ui";
import {
  BID_COMPANY_NAME,
  HELD_REASON_LABEL,
  heldReasonFixedByRecording,
  lotName,
} from "./held-reasons";
import { agreementHref } from "./lot-seller-proceeds.vm";

/** Where a sale's rate comes from, on a preview or payout row. */
export type RowRateSource =
  | { kind: "agreement"; reference: string; href: string; signedAt: string | null }
  | { kind: "recorded_by_staff"; reference: string; href: string }
  | null;

export function rowRateSource(
  agreement: Pick<SellerAgreementRef, "reference" | "submissionId" | "signedAt" | "source"> | null,
): RowRateSource {
  if (!agreement) return null;
  const href = agreementHref(agreement.submissionId);
  return agreement.source === "recorded"
    ? { kind: "recorded_by_staff", reference: agreement.reference, href }
    : { kind: "agreement", reference: agreement.reference, href, signedAt: agreement.signedAt };
}

export type SettlementRow = {
  id: string;
  lotId: string | null;
  lot: string;
  lotTitle: string | null;
  lotHref: string | null;
  hammer: string;
  /** "12%  −£744.00"; empty for a held sale. */
  commissionRate: string | null;
  commission: string | null;
  vatRate: string | null;
  vat: string | null;
  net: string | null;
  rateSource: RowRateSource;
  held: { reason: string; canRecord: boolean } | null;
};

export type SettlementSummary = {
  /** "Sales ready 3 of 4". */
  readyLabel: string;
  /** "1 held", or null when nothing is held. */
  heldLabel: string | null;
  hammer: string;
  commission: string;
  vat: string;
  net: string;
};

export type SettlementPreviewModel =
  | { kind: "open_payout"; statusLabel: string }
  | { kind: "nothing_to_settle" }
  | { kind: "vat_missing"; rows: SettlementRow[] }
  | {
      kind: "sales";
      rows: SettlementRow[];
      summary: SettlementSummary;
      premiumLine: string;
      /** Set when there is something to pay. */
      run: { label: string; amount: string; confirmTitle: string; confirmBody: string } | null;
      /** Why the run button is off: "Every sale is held". */
      disabledReason: string | null;
    };

const money = (pence: number, currency: string) => formatStaffMoney(pence, currency);
const minus = (pence: number, currency: string) =>
  formatStaffMoney(pence === 0 ? 0 : -pence, currency);

function rowFor(sale: SettlementPreviewSaleDto, currency: string): SettlementRow {
  const base = {
    id: sale.paymentId,
    lotId: sale.lotId,
    lot: lotName({ lotNumber: sale.lotNumber, lotTitle: sale.lotTitle }),
    lotTitle: sale.lotTitle,
    lotHref: sale.lotId ? `/admin/lots/${encodeURIComponent(sale.lotId)}` : null,
    rateSource: rowRateSource(sale.agreement),
  };
  if (sale.kind === "held") {
    return {
      ...base,
      hammer: sale.hammerPence === null ? "" : money(sale.hammerPence, currency),
      commissionRate: null,
      commission: null,
      vatRate: null,
      vat: null,
      net: null,
      rateSource: null,
      held: {
        reason: HELD_REASON_LABEL[sale.reason],
        canRecord: heldReasonFixedByRecording(sale.reason) && sale.lotId !== null,
      },
    };
  }
  return {
    ...base,
    hammer: money(sale.hammerPence, currency),
    commissionRate: formatBpsAsPercent(sale.commissionBps),
    commission: minus(sale.commissionPence, currency),
    vatRate:
      sale.commissionVatTreatment === "not_registered"
        ? "No VAT"
        : formatBpsAsPercent(sale.commissionVatBps),
    vat: minus(sale.commissionVatPence, currency),
    net: money(sale.netPence, currency),
    held: null,
  };
}

/** The ready lines added up: the one source of every total on the page. */
export function sumReady(sales: readonly SettlementPreviewSaleDto[]): SettlementPreviewTotalsDto {
  const totals = {
    hammerPence: 0,
    commissionPence: 0,
    commissionVatPence: 0,
    refundChargePence: 0,
    netPence: 0,
  };
  for (const sale of sales) {
    if (sale.kind !== "ready") continue;
    totals.hammerPence += sale.hammerPence;
    totals.commissionPence += sale.commissionPence;
    totals.commissionVatPence += sale.commissionVatPence;
    totals.refundChargePence += sale.refundChargePence;
    totals.netPence += sale.netPence;
  }
  return totals;
}

function heldSentence(held: readonly SettlementRow[]): string {
  if (held.length === 0) return "";
  if (held.length === 1) {
    return ` ${held[0]?.lot} stays held and joins a later payout once its agreement is recorded.`;
  }
  const names = held.map((row) => row.lot);
  const list = `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return ` ${list} stay held and join a later payout once their agreements are recorded.`;
}

function stayHeld(held: readonly SettlementRow[]): string {
  if (held.length === 0) return "";
  if (held.length === 1) return ` ${held[0]?.lot} stays held.`;
  return ` ${held.length} held sales stay held.`;
}

/** Words staff read for an open payout's status. */
export type PayoutStatusLabel = (status: string) => string;

/**
 * The settlement preview for one seller: one row per waiting sale with the snapshot's figures, held
 * sales in place with their reason, and totals that are exactly the ready rows added up.
 */
export function buildSettlementPreview(
  preview: AdminSettlementPreview,
  sellerName: string,
  statusLabel: PayoutStatusLabel,
): SettlementPreviewModel {
  const { pending, openPayout } = preview;
  const currency = pending.currency;
  if (openPayout) return { kind: "open_payout", statusLabel: statusLabel(openPayout.status) };
  if (pending.sales.length === 0 && pending.paymentCount === 0)
    return { kind: "nothing_to_settle" };

  const rows = pending.sales.map((sale) => rowFor(sale, currency));
  if (pending.sales.some((sale) => sale.kind === "held" && sale.reason === "vat_setting_missing")) {
    return { kind: "vat_missing", rows };
  }
  const held = rows.filter((row) => row.held);
  const ready = rows.length - held.length;
  const totals = sumReady(pending.sales);
  const amount = money(totals.netPence, currency);
  const sales = ready === 1 ? "1 ready sale" : `${ready} ready sales`;
  return {
    kind: "sales",
    rows,
    summary: {
      readyLabel: `Sales ready ${ready} of ${rows.length}`,
      heldLabel: held.length > 0 ? `${held.length} held` : null,
      hammer: money(totals.hammerPence, currency),
      commission: money(totals.commissionPence, currency),
      vat: money(totals.commissionVatPence, currency),
      net: amount,
    },
    premiumLine: `Buyer's premium on these sales is kept by LAX and isn't part of this payout.${heldSentence(held)}`,
    run:
      ready > 0
        ? {
            label: `Run settlement for ${amount}`,
            amount,
            confirmTitle: `Pay ${amount} to ${sellerName} now?`,
            confirmBody: `A payout is created at once from the ${sales} above and sent to the seller's payout account.${stayHeld(held)} It cannot be undone from here.`,
          }
        : null,
    disabledReason: ready === 0 ? "Every sale is held" : null,
  };
}

export const SETTLEMENT_COPY = {
  nothingToSettle: "No captured payments are waiting to settle for this entity.",
  openPayoutTitle: "This entity already has an open payout",
  allHeldTitle: "Nothing can be paid yet",
  vatMissingTitle: "Payouts are held",
  vatMissing:
    "Payouts are held until an Administrator sets whether the company charges VAT on commission, in Finance › Settings.",
  vatCompany: BID_COMPANY_NAME,
  reasonLabel: "Reason for running this settlement",
  reasonHint: "Kept with the payout and in the audit log.",
} as const;
