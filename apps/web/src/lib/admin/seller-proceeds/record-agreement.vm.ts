import type {
  SellerHeldReason,
  SellerVatTreatment,
} from "@/lib/data/http/admin-seller-proceeds.shared";
import { commissionPercentToBps, sellerProceeds } from "@auction/domain";
import {
  SIGNED_AGREEMENT_FIELDS,
  type SignedAgreementErrors,
  type SignedAgreementField,
  checkSignedAgreement,
  signedAgreementCommission,
} from "@auction/validators";
import { BID_COMPANY_NAME, HELD_REASON_LABEL } from "./held-reasons";

/** What the record dialog needs to know about the held sale. Figures are the snapshot's. */
export type RecordAgreementContext = {
  lotId: string;
  /** "Lot 21". */
  lot: string;
  lotTitle: string;
  sellerName: string | null;
  hammerPence: number;
  vatSetting: SellerVatTreatment | null;
};

export type RecordAgreementDraft = {
  commissionPercent: string;
  signedOn: string;
  uploadObjectId: string | null;
  reason: string;
};

export const RECORD_AGREEMENT_COPY = {
  title: "Record the signed agreement",
  replaceTitle: "Replace with a corrected agreement",
  commission: "Commission",
  commissionHint: "Charged on the hammer price. VAT is added on top.",
  signedOn: "Signed on",
  document: "Signed agreement",
  documentHint: "PDF, up to 20 MB. Kept with the consignment.",
  reason: "Why it's recorded here",
  reasonHint: "Kept in the audit log.",
  cancel: "Cancel",
  submit: "Record agreement",
  submitting: "Recording…",
  replaceSubmit: "Replace agreement",
} as const;

export type RecordAgreementCheck = {
  errors: SignedAgreementErrors;
  /** In the order the form shows them, for the error summary. */
  list: { field: SignedAgreementField; message: string }[];
  /** "Check 2 fields", or null when nothing is wrong. */
  summary: string | null;
};

export function checkRecordAgreement(
  draft: RecordAgreementDraft,
  today: string,
): RecordAgreementCheck {
  const errors = checkSignedAgreement(draft, today);
  const list = SIGNED_AGREEMENT_FIELDS.flatMap((field) => {
    const message = errors[field];
    return message ? [{ field, message }] : [];
  });
  const summary =
    list.length === 0 ? null : list.length === 1 ? "Check 1 field" : `Check ${list.length} fields`;
  return { errors, list, summary };
}

/** What the seller would receive, priced by the one calculator as the commission is typed. */
export type RecordAgreementPreview =
  | {
      kind: "priced";
      commissionBps: number;
      commissionPence: number;
      vat:
        | { kind: "charged"; rateBps: number; pence: number }
        | { kind: "not_registered"; companyName: string };
      netPence: number;
    }
  | { kind: "none" };

export function previewRecordedAgreement(
  commissionText: string,
  hammerPence: number,
  vat: SellerVatTreatment | null,
): RecordAgreementPreview {
  const checked = checkSignedAgreement(
    {
      commissionPercent: commissionText,
      signedOn: "2000-01-01",
      uploadObjectId: "x",
      reason: "xxxxxxxxxx",
    },
    "2000-01-01",
  );
  if (checked.commissionPercent) return { kind: "none" };
  const commissionBps = commissionPercentToBps(signedAgreementCommission(commissionText));
  if (commissionBps === null) return { kind: "none" };
  const proceeds = sellerProceeds({
    hammerPence,
    party: { kind: "agreement", commissionBps },
    vat,
  });
  if (proceeds.basis !== "agreement") return { kind: "none" };
  return {
    kind: "priced",
    commissionBps,
    commissionPence: proceeds.commissionPence,
    vat:
      proceeds.vatTreatment === "not_registered"
        ? { kind: "not_registered", companyName: BID_COMPANY_NAME }
        : { kind: "charged", rateBps: proceeds.vatBps, pence: proceeds.vatPence },
    netPence: proceeds.netPence,
  };
}

/** What the API says recording did to the lot's sale. */
export type RecordedSale =
  | { kind: "released" }
  | { kind: "still_held"; reason: SellerHeldReason }
  | { kind: "already_paid" }
  | { kind: "already_priced" }
  | { kind: "no_sale" };

/**
 * The toast after recording: the payout promise only when the API reports the sale released;
 * a sale that stays held says why; anything else is just recorded.
 */
export function recordedToast(lot: string, sale: RecordedSale | null): string {
  if (sale?.kind === "released") return `Agreement recorded. ${lot} joins the next payout.`;
  if (sale?.kind === "still_held") {
    return `Agreement recorded. ${lot}'s payout is still held: ${HELD_REASON_LABEL[sale.reason]}.`;
  }
  return "Agreement recorded.";
}
