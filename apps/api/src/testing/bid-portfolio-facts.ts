import type {
  BidPaymentFact,
  BidPayoutFact,
  BidPortfolioFacts,
  BidSellerLotFact,
  BidSubmissionFact,
  BidWonLotFact,
} from "@auction/persistence/interfaces";

export const NO_FACTS: BidPortfolioFacts = {
  wonLots: [],
  payments: [],
  submissions: [],
  sellerLots: [],
  payouts: [],
};

export function facts(overrides: Partial<BidPortfolioFacts> = {}): BidPortfolioFacts {
  return { ...NO_FACTS, ...overrides };
}

export function wonLot(overrides: Partial<BidWonLotFact> = {}): BidWonLotFact {
  return {
    lotId: "11111111-1111-4111-8111-111111111111",
    title: "Blue Study",
    artistName: "Ada Artist",
    firstImageKey: "lots/blue-study.jpg",
    hammerPrice: "1000.00",
    endedAt: new Date("2026-03-01T10:00:00.000Z"),
    fulfilmentStatus: null,
    ...overrides,
  };
}

export function payment(overrides: Partial<BidPaymentFact> = {}): BidPaymentFact {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    lotId: "11111111-1111-4111-8111-111111111111",
    amount: "1250.00",
    status: "captured",
    createdAt: new Date("2026-03-02T09:00:00.000Z"),
    hasInvoice: true,
    ...overrides,
  };
}

export function submission(overrides: Partial<BidSubmissionFact> = {}): BidSubmissionFact {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    title: "Red Field",
    firstImageKey: null,
    createdAt: new Date("2026-02-01T08:00:00.000Z"),
    ...overrides,
  };
}

export function sellerLot(overrides: Partial<BidSellerLotFact> = {}): BidSellerLotFact {
  return {
    lotId: "44444444-4444-4444-8444-444444444444",
    title: "Green Line",
    artistName: null,
    firstImageKey: null,
    stage: "in_sale",
    occurredAt: new Date("2026-01-10T08:00:00.000Z"),
    buyerPaid: false,
    payoutStatus: null,
    payoutHasStatement: false,
    ...overrides,
  };
}

export function payout(overrides: Partial<BidPayoutFact> = {}): BidPayoutFact {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    currency: "GBP",
    netAmount: "900.00",
    platformFee: "75.00",
    stripeFee: "25.00",
    status: "paid",
    periodEnd: new Date("2026-04-01T00:00:00.000Z"),
    processedAt: new Date("2026-04-03T12:00:00.000Z"),
    hasStatement: true,
    ...overrides,
  };
}
