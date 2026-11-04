import type {
  PrivateSaleDealDetail,
  PrivateSaleDealDocument,
  PrivateSaleDealStage,
  PrivateSalePartyRole,
} from "@auction/types";

export type TermsAcceptance = Record<PrivateSalePartyRole, boolean>;

/**
 * Whether each side has accepted the given terms version in the product. An acceptance counts
 * for the legal entity that is the party now, so replacing a party starts their acceptance again.
 */
export function termsAcceptance(
  deal: Pick<PrivateSaleDealDetail, "seller" | "buyer">,
  documents: readonly PrivateSaleDealDocument[],
  termsVersion: string,
): TermsAcceptance {
  const accepted = (legalEntityId: string | undefined) =>
    legalEntityId !== undefined &&
    documents.some(
      (d) =>
        d.kind === "terms" &&
        d.version === termsVersion &&
        d.acceptedAt !== null &&
        d.legalEntityId === legalEntityId,
    );
  return {
    seller: accepted(deal.seller.legalEntityId),
    buyer: accepted(deal.buyer?.legalEntityId),
  };
}

export type DealTermField =
  | "price"
  | "buyerFee"
  | "sellerCommission"
  | "costs"
  | "vatTreatment"
  | "partiesDisclosed";

/**
 * Which terms may still be changed in each stage. The price is fixed once both sides have agreed
 * to it; the fee, commission, costs and VAT treatment stay open until the invoice is issued, so
 * finance can finish them after the agreement. Nothing changes after that: to change an invoiced
 * deal, cancel it and start again.
 */
const EDITABLE_TERMS: Readonly<Record<PrivateSaleDealStage, readonly DealTermField[]>> = {
  proposed: ["price", "buyerFee", "sellerCommission", "costs", "vatTreatment", "partiesDisclosed"],
  offer: ["price", "buyerFee", "sellerCommission", "costs", "vatTreatment", "partiesDisclosed"],
  agreed: ["buyerFee", "sellerCommission", "costs", "vatTreatment", "partiesDisclosed"],
  cleared: ["buyerFee", "sellerCommission", "costs", "vatTreatment", "partiesDisclosed"],
  invoiced: [],
  paid: [],
  released: [],
  settled: [],
  cancelled: [],
};

export const editableDealTerms = (stage: PrivateSaleDealStage): readonly DealTermField[] =>
  EDITABLE_TERMS[stage];

export const dealTermIsEditable = (stage: PrivateSaleDealStage, field: DealTermField): boolean =>
  EDITABLE_TERMS[stage].includes(field);
