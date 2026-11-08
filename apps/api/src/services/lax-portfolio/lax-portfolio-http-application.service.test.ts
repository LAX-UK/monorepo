import { summariseAmountsOwed } from "@auction/domain";
import { type LaxPortfolioItemV1, buildMoney, buildPortfolioHeader } from "@auction/lax-ecosystem";
import type { BidPortfolioFacts, IBidPortfolioReader } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { facts, payment, wonLot } from "../../testing/bid-portfolio-facts.js";
import { AmountsOwedService } from "../amounts-owed/amounts-owed.service.js";
import { LaxPortfolioHttpApplicationService } from "./lax-portfolio-http-application.service.js";

/**
 * Money, Portfolio and the amounts-owed summary are three readings of one account. This runs the
 * real amounts-owed service over fakes of its ports and asks all three, so a rule that drifts in
 * any one of them makes the totals differ.
 */
const USER = "user-1";
const PERSONAL = "personal-1";
const ORG = "org-1";

const HELD = "11111111-1111-4111-8111-111111111111";
const RETRIED = "22222222-2222-4222-8222-222222222222";
const ORG_LOT = "33333333-3333-4333-8333-333333333333";

/** Every lot is 1000.00 hammer and carries a 15% buyer's premium: 1150.00 to pay. */
const lotRow = (id: string, buyerLegalEntityId: string) => ({
  id,
  status: "ended",
  saleId: "sale-1",
  winnerId: USER,
  buyerLegalEntityId,
  currentPrice: "1000.00",
  buyerPremiumRate: "0.15",
  endTime: new Date(),
});

function build(bid: BidPortfolioFacts, lots: ReturnType<typeof lotRow>[]) {
  const paymentRows = bid.payments.map((p) => ({
    id: p.id,
    lotId: p.lotId,
    status: p.status,
    manualReviewReason: p.status === "requires_manual_review" ? "aml_hold" : null,
    amount: p.amount,
    createdAt: p.createdAt.toISOString(),
  }));
  const amountsOwed = new AmountsOwedService({
    lotService: { list: vi.fn(async () => lots) } as never,
    saleService: {
      findByIds: vi.fn(async () => [{ id: "sale-1", buyerPremiumTiers: null } as never]),
    },
    paymentBuyerService: {
      listMyPaymentsForBuyerApi: vi.fn(async () => ({ data: paymentRows as never })),
      listEntityPaymentsForBuyerApi: vi.fn(async () => ({ data: [] as never })),
      getBuyerComplianceGateStatus: vi.fn(async () => ({ status: "clear" as const })),
    },
    fulfilments: { statusesForLots: vi.fn(async () => new Map<string, string>()) },
    stillToSend: { forPayments: async () => new Map() },
    personalAccount: { idFor: async () => PERSONAL },
  });
  const reader: IBidPortfolioReader = { loadForPerson: async () => bid };
  const service = new LaxPortfolioHttpApplicationService({
    reader,
    amountsOwed,
    mediaUrlResolver: { resolveManyUnique: async () => new Map() } as never,
    webOrigin: "https://lax.bid",
    legalName: "London Auction Xchange LTD",
  });
  return { service, amountsOwed };
}

const gbp = (totals: readonly { currency: string; amount: number | string }[]) =>
  Number(totals.find((total) => total.currency === "GBP")?.amount ?? 0);

async function threeReadings(bid: BidPortfolioFacts, lots: ReturnType<typeof lotRow>[]) {
  const { service, amountsOwed } = build(bid, lots);
  const portfolio = await service.getPortfolio({ userId: USER });
  const money = await service.getMoney({ userId: USER });
  const items = (portfolio.body as { items: LaxPortfolioItemV1[] }).items;
  const entries = (money.body as { entries: Parameters<typeof buildMoney>[0] }).entries;
  const owedByYou = buildMoney(entries)
    .groups.flatMap((group) => group.sections)
    .filter((section) => section.section === "owed_by_you")
    .flatMap((section) => section.subtotals);
  const summary = summariseAmountsOwed((await amountsOwed.forPerson(USER)).entries);
  return {
    items,
    moneyOwed: gbp(owedByYou) / 100,
    portfolioDue: gbp(buildPortfolioHeader(items).totalDue) / 100,
    summaryOwed: gbp(summary.totals),
  };
}

describe("Money, Portfolio and the amounts-owed summary agree", () => {
  it("owes a held purchase once on all three", async () => {
    const bid = facts({
      wonLots: [wonLot({ lotId: HELD })],
      payments: [
        payment({ id: "held", lotId: HELD, status: "requires_manual_review", amount: "1150.00" }),
      ],
    });
    const result = await threeReadings(bid, [lotRow(HELD, PERSONAL)]);
    expect(result.summaryOwed).toBe(1150);
    expect(result.moneyOwed).toBe(1150);
    expect(result.portfolioDue).toBe(1150);
  });

  it("owes nothing when an abandoned attempt is followed by a captured payment", async () => {
    const bid = facts({
      wonLots: [wonLot({ lotId: RETRIED })],
      payments: [
        payment({
          id: "abandoned",
          lotId: RETRIED,
          status: "pending",
          createdAt: new Date("2026-03-03T09:00:00Z"),
        }),
        payment({
          id: "captured",
          lotId: RETRIED,
          status: "captured",
          createdAt: new Date("2026-03-02T09:00:00Z"),
        }),
      ],
    });
    const result = await threeReadings(bid, [lotRow(RETRIED, PERSONAL)]);
    expect([result.summaryOwed, result.moneyOwed, result.portfolioDue]).toEqual([0, 0, 0]);
    expect(result.items.some((item) => item.status === "awaiting_payment")).toBe(false);
  });

  it("leaves a lot won for an organisation out of all three", async () => {
    const bid = facts({
      wonLots: [wonLot({ lotId: HELD }), wonLot({ lotId: ORG_LOT, title: "For the firm" })],
      payments: [
        payment({ id: "held", lotId: HELD, status: "requires_manual_review", amount: "1150.00" }),
      ],
    });
    const result = await threeReadings(bid, [lotRow(HELD, PERSONAL), lotRow(ORG_LOT, ORG)]);
    expect(result.summaryOwed).toBe(1150);
    expect(result.moneyOwed).toBe(1150);
    expect(result.portfolioDue).toBe(1150);
    expect(result.items.map((item) => item.title)).not.toContain("For the firm");
  });
});
