import type { LaxMoneyEntryV1, LaxPortfolioItemV1 } from "@auction/lax-ecosystem";

export const BID_BUSINESS = { key: "lax_bid", legalName: "LAX Bid Ltd" } as const;
export const ART_BUSINESS = { key: "lax_art", legalName: "London Art Exchange Ltd" } as const;

export function item(overrides: Partial<LaxPortfolioItemV1> = {}): LaxPortfolioItemV1 {
  return {
    product: "bid",
    id: "lot-1",
    title: "Green Line",
    artist: "Ada Artist",
    image: null,
    acquiredAt: "2026-03-01T10:00:00.000Z",
    status: "owned",
    paid: { lines: [] },
    documents: [],
    actions: [],
    business: BID_BUSINESS,
    ...overrides,
  };
}

export function moneyEntry(overrides: Partial<LaxMoneyEntryV1> = {}): LaxMoneyEntryV1 {
  return {
    id: "m-1",
    business: BID_BUSINESS,
    direction: "paid",
    status: "completed",
    amount: 100_000,
    currency: "GBP",
    occurredAt: "2026-03-01T10:00:00.000Z",
    href: "https://lax.bid/purchases#payment-history",
    ...overrides,
  };
}
