import type {
  PrivateSaleDealDetail,
  PrivateSaleDealDocument,
  PrivateSaleDealParty,
} from "@auction/types";
import type { DealClearanceSnapshot } from "./clearance.js";
import { type PrivateSalePolicy, resolvePrivateSalePolicy } from "./policy.js";
import type { DealTransitionContext } from "./transitions.js";

export const NOW = new Date("2026-11-03T10:00:00Z");

export const SELLER: PrivateSaleDealParty = {
  role: "seller",
  legalEntityId: "le-seller",
  displayName: "Henry Lowe",
  actingUserId: "u-seller",
};
export const BUYER: PrivateSaleDealParty = {
  role: "buyer",
  legalEntityId: "le-buyer",
  displayName: "Marlow Collection Ltd",
  actingUserId: "u-buyer",
};

export function deal(overrides: Partial<PrivateSaleDealDetail> = {}): PrivateSaleDealDetail {
  return {
    id: "deal-1",
    reference: "PS-0001",
    stage: "proposed",
    itemSubmissionId: "sub-1",
    artworkRegisterId: null,
    artworkUnlinkedReason: null,
    sourceEnquiryId: null,
    sourceUnsoldLotChoiceId: null,
    ownerUserId: "u-owner",
    priceMinor: null,
    buyerFeeBps: 0,
    sellerCommissionBps: null,
    costsMinor: 0,
    vatTreatment: null,
    partiesDisclosed: false,
    offerExpiresAt: null,
    paymentDueAt: null,
    collectionDueAt: null,
    agreedAt: null,
    agreedByUserId: null,
    invoicedByUserId: null,
    invoiceReference: null,
    cancelReason: null,
    cancelledAt: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    seller: SELLER,
    buyer: null,
    documents: [],
    ...overrides,
  };
}

/** A configured policy: every value that is normally set by configuration is set. */
export const POLICY: PrivateSalePolicy = resolvePrivateSalePolicy({
  commissionRateBps: 1500,
  vatTreatments: [
    { code: "margin_scheme", label: "Margin scheme" },
    { code: "agent_commission_only", label: "Agent's commission only" },
  ],
  termsVersion: "v1",
  paymentDueDays: 7,
  collectionDueDays: 14,
});

export const CLEAR_SNAPSHOT: DealClearanceSnapshot = {
  seller: { kyc: "clear", aml: "clear" },
  buyer: { kyc: "clear", aml: "clear" },
  buyerSourceOfFunds: "not_requested",
  buyerOtherOpenExposureMinor: 0,
};

export function context(overrides: Partial<DealTransitionContext> = {}): DealTransitionContext {
  return {
    actorUserId: "u-staff",
    now: NOW,
    policy: POLICY,
    clearance: CLEAR_SNAPSHOT,
    termsAcceptance: { seller: true, buyer: true },
    ...overrides,
  };
}

export function acceptedTerms(
  party: PrivateSaleDealParty,
  version = "v1",
): PrivateSaleDealDocument {
  return {
    id: `doc-${party.role}`,
    dealId: "deal-1",
    kind: "terms",
    audience: "both",
    legalEntityId: party.legalEntityId,
    version,
    uploadObjectId: null,
    acceptedAt: NOW,
    acceptedByUserId: party.actingUserId,
    createdByUserId: party.actingUserId,
    createdAt: NOW,
  };
}
