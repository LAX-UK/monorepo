import type { DealListItem, DealRecord } from "@/lib/data/http/admin-private-sales.schema";

export function listItem(overrides: Partial<DealListItem> = {}): DealListItem {
  return {
    id: "deal-12",
    reference: "PS-0012",
    stage: "offer",
    workTitle: "Harbour at dusk",
    workReference: "C-1042",
    sellerName: "Henry Lowe",
    buyerName: "Marlow Collection Ltd",
    priceMinor: 4_800_000,
    ownerUserId: "u-tom",
    offerExpiresAt: "2026-11-12T17:00:00.000Z",
    paymentDueAt: null,
    collectionDueAt: null,
    updatedAt: "2026-11-03T10:00:00.000Z",
    ...overrides,
  };
}

const ALL_CLEAR = { kyc: "clear", aml: "clear" } as const;

/** A fully configured deal in the offer stage, as a sales manager sees it. */
export function dealRecord(overrides: Partial<DealRecord> = {}): DealRecord {
  return {
    reference: "PS-0012",
    stage: "offer",
    version: 4,
    work: { id: "sub-1", title: "Harbour at dusk", reference: "C-1042" },
    sourceEnquiryReference: "E-1042",
    ownerUserId: "u-tom",
    priceMinor: 4_800_000,
    buyerFeeBps: 0,
    sellerCommissionBps: 1500,
    costsMinor: 25_000,
    vatTreatment: null,
    partiesDisclosed: false,
    offerExpiresAt: null,
    paymentDueAt: null,
    collectionDueAt: null,
    agreedAt: null,
    invoiceReference: null,
    cancelReason: null,
    cancelledAt: null,
    createdAt: "2026-11-01T09:00:00.000Z",
    updatedAt: "2026-11-03T10:00:00.000Z",
    money: {
      priceMinor: 4_800_000,
      buyerFeeMinor: 0,
      totalDueMinor: 4_800_000,
      sellerCommissionMinor: 720_000,
      costsMinor: 25_000,
      netToSellerMinor: 4_055_000,
    },
    artwork: {
      id: "reg-1",
      title: "Evening Tide",
      artist: "Hannah Cole",
      medium: "Oil on canvas",
      size: "76 x 102 cm",
      stockCode: "LAX-ORI-HC-24-0042",
      catalogueStatus: "Available",
      thumbnailUrl: null,
      whereItIs: {
        key: "private_sale",
        chip: { label: "In a private sale", tone: "info", marker: "filled" },
      },
      heldSince: "2026-11-01T09:00:00.000Z",
      recordHref: "https://admin.lax.test/from-zoho/reg-1",
    },
    artworkUnlinkedReason: null,
    artworkAccess: { canLink: false, canChange: true, changeOffReason: null },
    artworkMoves: [],
    seller: {
      role: "seller",
      legalEntityId: "le-seller",
      displayName: "Henry Lowe",
      ...ALL_CLEAR,
      accepted: true,
    },
    buyer: {
      role: "buyer",
      legalEntityId: "le-buyer",
      displayName: "Marlow Collection Ltd",
      ...ALL_CLEAR,
      accepted: false,
    },
    sourceOfFunds: { status: "pending", required: true, thresholdMinor: 900_000 },
    documents: [],
    payment: null,
    timeline: [
      {
        fromStage: null,
        toStage: "proposed",
        reason: null,
        createdAt: "2026-11-01T09:00:00.000Z",
        actorName: "Tom Reid",
      },
      {
        fromStage: "proposed",
        toStage: "offer",
        reason: null,
        createdAt: "2026-11-02T09:00:00.000Z",
        actorName: "Tom Reid",
      },
    ],
    policy: {
      gaps: [],
      termsVersion: "v1",
      vatTreatments: [
        { code: "margin_scheme", label: "Margin scheme" },
        { code: "agent_commission", label: "Agent's commission only" },
      ],
    },
    editableTerms: ["priceMinor", "costsMinor", "partiesDisclosed", "offerExpiresAt"],
    canNameBuyer: true,
    actions: [
      {
        action: "agree",
        blockers: [
          {
            code: "terms_not_accepted",
            message: "The buyer has not accepted the private sale terms.",
            party: "buyer",
          },
        ],
      },
      { action: "cancel", blockers: [] },
    ],
    ...overrides,
  };
}

/** The same deal before anything is configured: the "Terms not configured" state. */
export function unconfiguredDeal(overrides: Partial<DealRecord> = {}): DealRecord {
  return dealRecord({
    sellerCommissionBps: null,
    money: {
      priceMinor: 4_800_000,
      buyerFeeMinor: 0,
      totalDueMinor: 4_800_000,
      sellerCommissionMinor: null,
      costsMinor: 25_000,
      netToSellerMinor: null,
    },
    policy: {
      gaps: ["terms_version", "commission_rate", "vat_treatments", "payment_due_days"],
      termsVersion: null,
      vatTreatments: [],
    },
    actions: [
      {
        action: "agree",
        blockers: [
          {
            code: "terms_version_not_configured",
            message: "The private sale terms have not been set up yet.",
          },
        ],
      },
      { action: "cancel", blockers: [] },
    ],
    ...overrides,
  });
}
