import type { PrivateSalePartyRole } from "@auction/types";

/** Why a deal cannot make a move. One code per reason, so a screen can say why a button is off. */
export type DealBlockerCode =
  | "invalid_transition"
  | "buyer_not_named"
  | "price_not_set"
  | "party_missing"
  | "kyc_not_clear"
  | "aml_not_clear"
  | "terms_version_not_configured"
  | "terms_not_accepted"
  | "source_of_funds_not_satisfied"
  | "vat_treatments_not_configured"
  | "vat_treatment_not_chosen"
  | "vat_treatment_not_allowed"
  | "commission_not_set"
  | "commission_rate_not_configured"
  | "checks_pending"
  | "payment_due_days_not_configured"
  | "same_person_agreed_and_invoiced"
  | "cancel_reason_required"
  | "release_note_required"
  | "refund_not_recorded";

export type DealBlocker = {
  code: DealBlockerCode;
  /** The party the reason is about, when it is about one. */
  party?: PrivateSalePartyRole;
};

const PARTY_LABEL: Record<PrivateSalePartyRole, string> = {
  seller: "The seller",
  buyer: "The buyer",
};

/** The reason in plain words for staff. */
export function describeDealBlocker(blocker: DealBlocker): string {
  const who = blocker.party ? PARTY_LABEL[blocker.party] : "";
  switch (blocker.code) {
    case "invalid_transition":
      return "The deal is not in a stage where this can happen.";
    case "buyer_not_named":
      return "Name the buyer first.";
    case "price_not_set":
      return "Set the agreed price first.";
    case "party_missing":
      return `${who} needs an account before this can happen.`;
    case "kyc_not_clear":
      return `${who} has not verified their identity yet.`;
    case "aml_not_clear":
      return `${who}'s screening is not clear. Compliance decides.`;
    case "terms_version_not_configured":
      return "The private sale terms have not been set up yet.";
    case "terms_not_accepted":
      return `${who} has not accepted the private sale terms.`;
    case "source_of_funds_not_satisfied":
      return "The buyer's source of funds is not approved yet.";
    case "vat_treatments_not_configured":
      return "The VAT treatments have not been set up yet.";
    case "vat_treatment_not_chosen":
      return "Finance has not chosen the VAT treatment yet.";
    case "vat_treatment_not_allowed":
      return "The chosen VAT treatment is not on the approved list.";
    case "commission_rate_not_configured":
      return "The commission rate has not been set up yet.";
    case "checks_pending":
      return "Waiting on the compliance checks.";
    case "commission_not_set":
      return "The seller's commission has not been set.";
    case "payment_due_days_not_configured":
      return "The payment deadline has not been set up yet.";
    case "same_person_agreed_and_invoiced":
      return "The person who recorded the agreement cannot issue the invoice.";
    case "cancel_reason_required":
      return "Give a reason for cancelling.";
    case "release_note_required":
      return "Say how the work was handed over: collected, or shipped with a reference.";
    case "refund_not_recorded":
      return "Refund the buyer before cancelling a paid deal.";
  }
}
