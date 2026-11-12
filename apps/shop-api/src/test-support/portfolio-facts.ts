import type {
  PortalPortfolioFacts,
  PortfolioEditionFact,
  PortfolioOrderFact,
  PortfolioOriginalFact,
  PortfolioPendingOrderLineFact,
  PortfolioRefundFact,
  PortfolioSaleFact,
  PortfolioSettledLineFact,
  PortfolioWork,
} from "../application/ports/portal-portfolio.reader.js";

export const NO_FACTS: PortalPortfolioFacts = {
  editions: [],
  originals: [],
  pendingOrderLines: [],
  settledOrderLines: [],
  sales: [],
  orders: [],
  refunds: [],
};

export function facts(overrides: Partial<PortalPortfolioFacts> = {}): PortalPortfolioFacts {
  return { ...NO_FACTS, ...overrides };
}

export function work(overrides: Partial<PortfolioWork> = {}): PortfolioWork {
  return {
    artworkId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    slug: "quiet-orchard",
    title: "Quiet Orchard",
    artistName: "Ines Okafor",
    imageKey: "artworks/quiet-orchard.jpg",
    channel: "shop",
    ...overrides,
  };
}

export function edition(overrides: Partial<PortfolioEditionFact> = {}): PortfolioEditionFact {
  return {
    editionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    work: work(),
    print: { editionNumber: 3, proofNumber: null, stockRef: 3 },
    runFacts: null,
    listingStatus: "sold",
    purchase: {
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      orderLineId: "11111111-1111-4111-8111-111111111111",
      orderStatus: "paid",
      channel: "shop",
      paidAt: new Date("2026-05-02T12:00:00.000Z"),
      unitPricePence: 45_000,
      fulfilmentStatus: "delivered",
    },
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    certificate: "none",
    ...overrides,
  };
}

export function original(overrides: Partial<PortfolioOriginalFact> = {}): PortfolioOriginalFact {
  return {
    originalSaleId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    work: work({ channel: "art", slug: "harbour-light", title: "Harbour Light" }),
    channel: "art",
    status: "assigned",
    salePricePence: 1_200_000,
    updatedAt: new Date("2026-06-10T09:30:00.000Z"),
    ...overrides,
  };
}

export function pendingLine(
  overrides: Partial<PortfolioPendingOrderLineFact> = {},
): PortfolioPendingOrderLineFact {
  return {
    orderLineId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    orderId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    channel: "shop",
    work: work(),
    editionNumber: 4,
    unitPricePence: 45_000,
    createdAt: new Date("2026-07-01T08:00:00.000Z"),
    ...overrides,
  };
}

export function settledLine(
  overrides: Partial<PortfolioSettledLineFact> = {},
): PortfolioSettledLineFact {
  return {
    orderLineId: "22222222-2222-4222-8222-222222222222",
    orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    channel: "shop",
    work: work({
      artworkId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2",
      slug: "released",
      title: "Released Work",
    }),
    unitPricePence: 30_000,
    createdAt: new Date("2026-05-02T11:55:00.000Z"),
    ...overrides,
  };
}

export function sale(overrides: Partial<PortfolioSaleFact> = {}): PortfolioSaleFact {
  return {
    payoutId: "99999999-9999-4999-8999-999999999999",
    work: work(),
    grossPence: 100_000,
    deductionsPence: 20_000,
    netPence: 80_000,
    status: "paid",
    payoutDueAt: new Date("2026-04-01T00:00:00.000Z"),
    paidAt: new Date("2026-04-03T10:00:00.000Z"),
    createdAt: new Date("2026-03-20T10:00:00.000Z"),
    ...overrides,
  };
}

export function order(overrides: Partial<PortfolioOrderFact> = {}): PortfolioOrderFact {
  return {
    orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    channel: "shop",
    status: "paid",
    totalPence: 47_500,
    shippingPence: 2_500,
    paidAt: new Date("2026-05-02T12:00:00.000Z"),
    createdAt: new Date("2026-05-02T11:50:00.000Z"),
    checkoutExpiresAt: null,
    ...overrides,
  };
}

export function refund(overrides: Partial<PortfolioRefundFact> = {}): PortfolioRefundFact {
  return {
    refundId: "88888888-8888-4888-8888-888888888888",
    orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    orderLineId: null,
    channel: "shop",
    amountPence: 47_500,
    status: "succeeded",
    createdAt: new Date("2026-05-20T10:00:00.000Z"),
    ...overrides,
  };
}
