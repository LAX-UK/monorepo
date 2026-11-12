import type { ReofferPreview, StaffBuyerDefault, StaffReoffer } from "@auction/validators";

/** A defaulted lot and its offers as the API describes them, for the card, header and tab tests. */
export const BUYER_DEFAULT: StaffBuyerDefault = {
  id: "default-1",
  recordedAt: "2026-11-10T10:12:00.000Z",
  recordedByName: "Eleanor Pereira",
  reason: "No payment after three reminders.",
  outcome: "offered_to_underbidder",
  originalHammerMinor: 8_800_000,
  wonAt: "2026-10-29T18:42:00.000Z",
  buyerRestricted: true,
  buyerUserId: "buyer-1",
  buyerAccountName: "Defaulting Ltd",
  voidedInvoiceNumber: "LAX-B-2026-0412",
  voidedInvoiceTotalMinor: 11_440_000,
  voidedInvoiceDueAt: "2026-11-05T23:59:00.000Z",
};

export const PRICE = {
  hammerMinor: 8_200_000,
  buyersPremiumMinor: 2_050_000,
  vatOnPremiumMinor: 410_000,
  vatOnLotMinor: null,
  artistsResaleRightMinor: null,
  totalMinor: 10_660_000,
};

export function offer(overrides: Partial<StaffReoffer> = {}): StaffReoffer {
  return {
    id: "offer-1",
    lotId: "lot-1",
    sequence: 1,
    status: "awaiting_seller",
    consentStatus: "requested",
    bidder: { userId: "bidder-1", legalEntityId: "entity-1", accountName: "Northbank Gallery" },
    offerMinor: 8_200_000,
    price: PRICE,
    sourceBidId: "bid-2",
    bidPlacedAt: "2026-10-23T18:11:00.000Z",
    originalHammerMinor: 8_800_000,
    belowReserve: false,
    consentDueAt: "2026-11-13T17:00:00.000Z",
    consent: {
      channel: null,
      requestedAt: "2026-11-10T10:30:00.000Z",
      remindedAt: null,
      answeredAt: null,
      answeredByName: null,
      note: null,
      declinePreference: null,
    },
    createdAt: "2026-11-10T10:30:00.000Z",
    createdByName: "Eleanor Pereira",
    offerSentAt: null,
    offerEndsAt: null,
    respondedAt: null,
    declineReason: null,
    closeReason: null,
    closedByName: null,
    invoiceId: null,
    claimableShortfall: {
      hammerDifferenceMinor: 600_000,
      premiumLostMinor: 2_200_000,
      totalMinor: 2_800_000,
    },
    skippedBidders: [],
    ...overrides,
  };
}

export const PREVIEW: ReofferPreview = {
  soldOnAtg: false,
  next: {
    userId: "bidder-2",
    legalEntityId: "entity-2",
    accountName: "Hollis Byrne",
    bidMinor: 7_500_000,
    placedAt: "2026-10-22T18:42:00.000Z",
    belowReserve: false,
    othersAfter: 0,
  },
  noneReason: null,
  skippedBidders: [],
  offersMade: 1,
};

export const NO_PREVIEW: ReofferPreview = {
  soldOnAtg: false,
  next: null,
  noneReason: "no_other_bidder",
  skippedBidders: [],
  offersMade: 0,
};
