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
 * Which terms may still be changed in each stage. Everything either side accepted is locked
 * once the price is agreed: the price, the buyer's fee, the commission, the costs and whether the
 * parties are disclosed. Only the VAT treatment, an accounting choice that moves neither side's
 * money, stays open until the invoice is issued. To change anything else, cancel the deal and
 * start again, so no one is held to terms they did not accept.
 */
const EDITABLE_TERMS: Readonly<Record<PrivateSaleDealStage, readonly DealTermField[]>> = {
  proposed: ["price", "buyerFee", "sellerCommission", "costs", "vatTreatment", "partiesDisclosed"],
  offer: ["price", "buyerFee", "sellerCommission", "costs", "vatTreatment", "partiesDisclosed"],
  agreed: ["vatTreatment"],
  cleared: ["vatTreatment"],
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
