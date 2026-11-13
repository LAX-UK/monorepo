import type {
  LotSellerProceedsDto,
  SellerAgreementRef,
  SellerTermsDto,
} from "@/lib/data/http/admin-seller-proceeds.shared";
import {
  type SettlementBreakdownFigures,
  type SettlementBreakdownStatus,
  type SettlementPremium,
  type SettlementRateSource,
  type SettlementVat,
  formatStaffDateTime,
  formatStaffMoney,
} from "@auction/staff-ui";
import {
  BID_COMPANY_NAME,
  HELD_REASON_FIX,
  HELD_REASON_LABEL,
  heldReasonFixedByRecording,
  heldTitle,
  lotName,
} from "./held-reasons";

/** Where the consignment (and its agreement) is opened from. */
export function agreementHref(submissionId: string): string {
  return `/admin/inbox/${encodeURIComponent(submissionId)}`;
}

/** What the section offers to do next. */
export type ProceedsAction = "record_agreement" | "mark_settled_outside" | null;

/** Everything the breakdown shows, as plain data a server page can pass to the client. */
export type ProceedsBreakdown = SettlementBreakdownFigures & {
  status: SettlementBreakdownStatus;
  rateSource: SettlementRateSource | null;
  premium: SettlementPremium | null;
};

export type LotSellerProceedsModel =
  /** The lot has no sale: the section is not shown. */
  | { kind: "none" }
  /** A sale whose seller figures were never fixed (raised before snapshots). */
  | { kind: "no_snapshot"; message: string }
  | {
      kind: "breakdown";
      breakdown: ProceedsBreakdown;
      note: string | null;
      action: ProceedsAction;
    };

export const NOTES = {
  recalculated:
    "Recalculated under the signed agreement. This payment was raised before the change. The seller is paid under the agreement; the buyer's invoice is unchanged.",
  atg: "Sold through ATG. LAX doesn't pay ATG sales automatically. Follow the ATG settlement runbook with these figures.",
  laxOwned: "LAX's own stock. The whole hammer stays with LAX and nothing is paid out.",
  reawarded:
    "Re-awarded to the next bidder at a new hammer. The seller is paid on the new sale under the same agreement.",
  refunded:
    "The buyer was refunded after the seller was paid. The seller's share of the refund is taken back from their next payout.",
  noSnapshot:
    "The seller's figures are fixed when the buyer's invoice is raised. This sale has none yet.",
} as const;

/** "25.000" → "25%"; a premium with no single stated rate is named by its amount. */
export function premiumRateLabel(ratePercent: string | null, premiumPence: number): string {
  if (ratePercent === null) return formatStaffMoney(premiumPence);
  const match = /^(\d+)(?:\.(\d+))?$/.exec(ratePercent.trim());
  if (!match) return formatStaffMoney(premiumPence);
  const fraction = (match[2] ?? "").replace(/0+$/, "");
  return `${match[1]}${fraction ? `.${fraction}` : ""}%`;
}

function rateSourceFor(agreement: SellerAgreementRef | null): SettlementRateSource | null {
  if (!agreement) return null;
  if (agreement.source === "recorded") return { kind: "recorded_by_staff" };
  if (!agreement.signedAt) return null;
  return {
    kind: "agreement",
    reference: agreement.reference,
    signedAt: agreement.signedAt,
    href: agreementHref(agreement.submissionId),
  };
}

function vatFor(terms: SellerTermsDto): SettlementVat | null {
  if (terms.commissionVatTreatment === "not_registered") {
    return { kind: "not_registered", companyName: BID_COMPANY_NAME };
  }
  if (terms.commissionVatBps === null || terms.commissionVatPence === null) return null;
  return { kind: "charged", rateBps: terms.commissionVatBps, pence: terms.commissionVatPence };
}

type Sale = NonNullable<LotSellerProceedsDto["sale"]>;

/** The badge, in order of what staff most need to know. */
function statusFor(facts: LotSellerProceedsDto, sale: Sale, terms: SellerTermsDto) {
  const paid = sale.payout?.status === "paid";
  if (facts.soldOnAtg) return { kind: "settle_by_hand" } as const;
  if (terms.basis === "lax_owned") return { kind: "lax_owned" } as const;
  if (terms.basis === "held") return { kind: "held" } as const;
  if (sale.refundedAfterPayout) return { kind: "refunded_after_payout" } as const;
  if (terms.source === "recomputed_at_payout") return { kind: "recalculated" } as const;
  if (sale.reawarded && !paid) return { kind: "re_awarded" } as const;
  if (paid) {
    return { kind: "paid_out", paidAt: sale.payout?.processedAt ?? terms.computedAt } as const;
  }
  if (sale.paymentStatus === "captured" || sale.payout) return { kind: "ready" } as const;
  return { kind: "waiting_for_buyer" } as const;
}

function noteFor(status: SettlementBreakdownStatus, terms: SellerTermsDto): string | null {
  switch (status.kind) {
    case "settle_by_hand":
      return NOTES.atg;
    case "lax_owned":
      return NOTES.laxOwned;
    case "held":
      return terms.heldReason
        ? `${HELD_REASON_LABEL[terms.heldReason]}. ${HELD_REASON_FIX[terms.heldReason]}`
        : null;
    case "refunded_after_payout":
      return NOTES.refunded;
    case "recalculated":
      return NOTES.recalculated;
    case "re_awarded":
      return NOTES.reawarded;
    default:
      return null;
  }
}

/**
 * The "Seller proceeds" section of a sold lot. Every figure is the sale's snapshot as stored;
 * this only decides which state the sale is in and which words go with it.
 */
export function buildLotSellerProceeds(facts: LotSellerProceedsDto | null): LotSellerProceedsModel {
  const sale = facts?.sale;
  if (!facts || !sale) return { kind: "none" };
  const terms = sale.terms;
  if (!terms) return { kind: "no_snapshot", message: NOTES.noSnapshot };

  const status = statusFor(facts, sale, terms);
  const priced = terms.basis === "agreement";
  const paidOut = sale.payout?.status === "paid";
  const breakdown: ProceedsBreakdown = {
    hammerPence: terms.hammerPence,
    commission:
      priced && terms.commissionBps !== null && terms.commissionPence !== null
        ? { rateBps: terms.commissionBps, pence: terms.commissionPence }
        : null,
    vat: priced ? vatFor(terms) : null,
    netPence: priced ? terms.sellerNetPence : terms.basis === "lax_owned" ? 0 : null,
    paidOut,
    status,
    rateSource: priced ? rateSourceFor(facts.agreement) : null,
    premium: sale.invoice
      ? {
          rateLabel: premiumRateLabel(sale.invoice.premiumRatePercent, sale.invoice.premiumPence),
          buyerPaidPence: sale.invoice.totalPence,
        }
      : null,
  };

  let action: ProceedsAction = null;
  let note = noteFor(status, terms);
  if (status.kind === "settle_by_hand" && facts.settledOutsideAt) {
    note = `${NOTES.atg} Marked as settled outside LAX ${formatStaffDateTime(facts.settledOutsideAt)}.`;
  } else if (status.kind === "settle_by_hand") action = "mark_settled_outside";
  else if (
    status.kind === "held" &&
    terms.heldReason &&
    heldReasonFixedByRecording(terms.heldReason) &&
    facts.submissionId
  ) {
    action = "record_agreement";
  }
  return { kind: "breakdown", breakdown, note, action };
}

/** The section as the page renders it, including while it loads or when it could not load. */
export type LotSellerProceedsState =
  | LotSellerProceedsModel
  | { kind: "loading" }
  | { kind: "error" };

/** The lot header's notice for a held sale whose buyer has paid. */
export type HeldPayoutNotice = {
  title: string;
  body: string;
  /** Recording a signed agreement fixes it; otherwise the body says who does. */
  canRecord: boolean;
  /** The sale needs the Finance settings rather than an agreement. */
  settingsHref: string | null;
};

/** Where an Administrator sets whether the company charges VAT on commission. */
export const FINANCE_SETTINGS_HREF = "/admin/settings";

export function buildHeldPayoutNotice(facts: LotSellerProceedsDto | null): HeldPayoutNotice | null {
  const sale = facts?.sale;
  const terms = sale?.terms;
  if (!facts || !sale || !terms || terms.basis !== "held" || !terms.heldReason) return null;
  if (sale.paymentStatus !== "captured" || sale.payout || facts.soldOnAtg) return null;
  const reason = terms.heldReason;
  return {
    title: heldTitle(reason),
    body: `${lotName(facts)} sold for ${formatStaffMoney(terms.hammerPence)} and the buyer has paid. ${HELD_REASON_FIX[reason]}`,
    canRecord: heldReasonFixedByRecording(reason) && facts.submissionId !== null,
    settingsHref: reason === "vat_setting_missing" ? FINANCE_SETTINGS_HREF : null,
  };
}
