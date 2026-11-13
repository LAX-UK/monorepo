import type { PayoutSalesDto } from "@/lib/data/http/admin-seller-proceeds.shared";
import { formatBpsAsPercent, formatStaffMoney } from "@auction/staff-ui";
import { HELD_REASON_LABEL, heldReasonFixedByRecording, lotName } from "./held-reasons";
import { poundsToPence } from "./pounds";
import { type RowRateSource, rowRateSource } from "./settlement-preview.vm";

export type PanelFigure = { label: string; value: string };

export type PanelSaleLine = {
  id: string;
  lot: string;
  lotTitle: string;
  lotHref: string;
  hammer: string;
  /** "Commission 12% · VAT 20%", or the old fee for an old-rule line. */
  rate: string;
  net: string;
  rateSource: RowRateSource;
};

export type PanelHeldLine = {
  id: string;
  lotId: string;
  lot: string;
  lotTitle: string;
  hammer: string;
  reason: string;
  canRecord: boolean;
};

export type PayoutPanelModel = {
  oldRule: boolean;
  /** Said once on an old-rule payout: its figures are as paid. */
  oldRuleNote: string | null;
  figures: PanelFigure[];
  /** "3 sales". */
  inPayoutLabel: string;
  lines: PanelSaleLine[];
  notInPayout: PanelHeldLine[];
};

export const OLD_RULE_PANEL_NOTE =
  "Paid under the old rule. These are the figures it was paid with; the seller's signed agreement didn't set them.";

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/**
 * A payout's record panel: its totals as stored, one line per sale with the rate and agreement it
 * was paid under, and the seller's sales that are not in it because they are held. An old-rule
 * payout keeps the figures it was paid with and says so.
 */
export function buildPayoutPanel(dto: PayoutSalesDto, currency = "GBP"): PayoutPanelModel {
  const money = (pence: number) => formatStaffMoney(pence, currency);
  const fromPounds = (pounds: string) => money(poundsToPence(pounds));
  const { payout } = dto;
  const oldRule = payout.hammerAmount === null;

  const figures: PanelFigure[] = oldRule
    ? [
        { label: "Gross", value: fromPounds(payout.grossAmount) },
        { label: "Platform fee", value: fromPounds(payout.platformFee) },
        { label: "Stripe fee", value: fromPounds(payout.stripeFee) },
        { label: "Net", value: fromPounds(payout.netAmount) },
      ]
    : [
        { label: "Hammer", value: fromPounds(payout.hammerAmount ?? "0") },
        { label: "Commission", value: fromPounds(payout.commissionAmount ?? "0") },
        { label: "VAT on commission", value: fromPounds(payout.commissionVatAmount ?? "0") },
        { label: "Stripe fee", value: fromPounds(payout.stripeFee) },
        { label: "Net", value: fromPounds(payout.netAmount) },
      ];

  const lines = dto.sales.map((sale): PanelSaleLine => {
    const base = {
      id: sale.lineId,
      lot: lotName(sale),
      lotTitle: sale.lotTitle,
      lotHref: `/admin/lots/${encodeURIComponent(sale.lotId)}`,
      rateSource: rowRateSource(sale.agreement),
    };
    if (sale.terms) {
      const vat =
        sale.terms.commissionVatTreatment === "not_registered"
          ? "no VAT"
          : `VAT ${formatBpsAsPercent(sale.terms.commissionVatBps)}`;
      return {
        ...base,
        hammer: money(sale.terms.hammerPence),
        rate: `Commission ${formatBpsAsPercent(sale.terms.commissionBps)} · ${vat}`,
        net: money(sale.terms.sellerNetPence),
      };
    }
    const paid = poundsToPence(sale.oldRule?.paymentAmount ?? sale.amount);
    const fee = poundsToPence(sale.oldRule?.platformFee ?? "0");
    return {
      ...base,
      hammer: money(paid),
      rate: `Old fee ${money(fee)}`,
      net: money(paid - fee),
    };
  });

  const notInPayout = dto.heldForSeller.map((held) => ({
    id: held.paymentId,
    lotId: held.lotId,
    lot: lotName(held),
    lotTitle: held.lotTitle,
    hammer: money(held.hammerPence),
    reason: HELD_REASON_LABEL[held.heldReason],
    canRecord: heldReasonFixedByRecording(held.heldReason),
  }));

  return {
    oldRule,
    oldRuleNote: oldRule ? OLD_RULE_PANEL_NOTE : null,
    figures,
    inPayoutLabel: plural(lines.length, "sale"),
    lines,
    notInPayout,
  };
}
