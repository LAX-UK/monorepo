import { PURCHASE_LIST_LIMIT } from "@auction/domain";
import type { PaymentStatus } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { IStillToSendService } from "../payment-group/still-to-send.service.js";
import { AmountsOwedService } from "./amounts-owed.service.js";

const USER = "user-1";
const PERSONAL = "personal-1";
const ORG = "org-1";

type Fixture = {
  lotId: string;
  payment?: { status: PaymentStatus; manualReviewReason?: string | null };
  /** A checkout attempt started after `payment` and abandoned: the newest row for the lot. */
  newerAbandonedAttempt?: boolean;
  fulfilment?: string;
  buyerLegalEntityId?: string;
  winnerId?: string;
  /** The lot's hammer price as it reads now, if edited after the invoice was raised. */
  hammerNow?: string;
};

function lotFor(fixture: Fixture) {
  return {
    id: fixture.lotId,
    status: "ended",
    saleId: "sale-1",
    winnerId: fixture.winnerId ?? USER,
    buyerLegalEntityId: fixture.buyerLegalEntityId ?? PERSONAL,
  };
}

function build(
  fixtures: Fixture[],
  gate: "clear" | "aml_hold" | "source_of_funds_required" = "clear",
  stillToSend: IStillToSendService = { forPayments: async () => new Map() },
) {
  const lots = fixtures.map(lotFor);
  // The hammer is 1000.00 and the lot carries a 15% buyer's premium.
  const saleFindByIds = vi.fn(async () => [{ id: "sale-1", buyerPremiumTiers: null } as never]);
  const payments = fixtures.flatMap((f) =>
    f.payment
      ? [
          ...(f.newerAbandonedAttempt
            ? [
                {
                  id: `abandoned-${f.lotId}`,
                  lotId: f.lotId,
                  status: "pending" as PaymentStatus,
                  manualReviewReason: null,
                  amount: "1150.00",
                  createdAt: "2026-10-02T00:00:00.000Z",
                },
              ]
            : []),
          {
            id: `pay-${f.lotId}`,
            lotId: f.lotId,
            status: f.payment.status,
            manualReviewReason: f.payment.manualReviewReason ?? null,
            amount: "1150.00",
            createdAt: "2026-10-01T00:00:00.000Z",
          },
        ]
      : [],
  );
  const lotList = vi.fn(async () =>
    lots.map((lot) => ({
      ...lot,
      currentPrice: fixtures.find((f) => f.lotId === lot.id)?.hammerNow ?? "1000.00",
      buyerPremiumRate: "0.15",
      endTime: new Date(),
    })),
  );
  const service = new AmountsOwedService({
    lotService: { list: lotList } as never,
    saleService: { findByIds: saleFindByIds },
    paymentBuyerService: {
      listMyPaymentsForBuyerApi: vi.fn(async () => ({ data: payments as never })),
      listEntityPaymentsForBuyerApi: vi.fn(async () => ({ data: payments as never })),
      getBuyerComplianceGateStatus: vi.fn(async () => ({ status: gate })),
    },
    fulfilments: {
      statusesForLots: vi.fn(
        async () =>
          new Map(
            fixtures.flatMap((f) => (f.fulfilment ? [[f.lotId, f.fulfilment] as const] : [])),
          ),
      ),
    },
    stillToSend,
    personalAccount: { idFor: async () => PERSONAL },
  });
  return { service, lotList };
}

const entryFor = async (fixture: Fixture, gate?: Parameters<typeof build>[1]) => {
  const { service } = build([fixture], gate);
  const view = await service.forPerson(USER);
  return view.entries.find((entry) => entry.lotId === fixture.lotId) ?? null;
};

describe("which purchases the amounts owed follow", () => {
  it("reads the same number of lots as the Purchases list, for a person and an account", async () => {
    const { service, lotList } = build([{ lotId: "a" }]);
    await service.forPerson(USER);
    await service.forAccount({
      userId: USER,
      account: { legalEntityId: ORG, role: "owner", isImpersonation: false },
    });
    expect(lotList).toHaveBeenCalledTimes(2);
    for (const [filter] of lotList.mock.calls as unknown as [{ limit: number }][]) {
      expect(filter.limit).toBe(PURCHASE_LIST_LIMIT);
    }
  });

  it("leaves a purchase whose sale was cancelled out of what is to pay", async () => {
    const { service } = build([
      { lotId: "a" },
      { lotId: "b", payment: { status: "pending" }, fulfilment: "cancelled" },
    ]);
    const { entries } = await service.forPerson(USER);
    expect(entries.map((entry) => [entry.lotId, entry.state])).toEqual([
      ["a", "payment-due"],
      ["b", "cancelled"],
    ]);
  });
});

describe("amounts owed for a person", () => {
  it("owes the whole total, premium included, before any payment starts", async () => {
    expect(await entryFor({ lotId: "a" })).toMatchObject({
      state: "payment-due",
      role: "payer",
      amountDue: "1150.00",
      currency: "GBP",
      blocker: null,
    });
  });

  it("owes the invoice total even when the hammer price is edited after the invoice was raised", async () => {
    expect(
      await entryFor({ lotId: "a", payment: { status: "pending" }, hammerNow: "5000.00" }),
    ).toMatchObject({ state: "payment-due", amountDue: "1150.00" });
    // Before any invoice, the lot is priced as it reads now.
    expect(await entryFor({ lotId: "b", hammerNow: "5000.00" })).toMatchObject({
      amountDue: "5750.00",
    });
  });

  it("owes nothing on a paid lot whose newest payment row is an abandoned attempt", async () => {
    expect(
      await entryFor({
        lotId: "a",
        payment: { status: "captured" },
        newerAbandonedAttempt: true,
      }),
    ).toBeNull();
  });

  it("owes an unpaid invoice", async () => {
    expect(await entryFor({ lotId: "a", payment: { status: "pending" } })).toMatchObject({
      state: "payment-due",
    });
  });

  it("is in review while checks are open on the account", async () => {
    expect(await entryFor({ lotId: "a" }, "source_of_funds_required")).toMatchObject({
      state: "in-review",
      blocker: "documents",
    });
    expect(await entryFor({ lotId: "a" }, "aml_hold")).toMatchObject({
      state: "in-review",
      blocker: "review",
    });
  });

  it("is in review while the payment itself is held", async () => {
    expect(
      await entryFor({
        lotId: "a",
        payment: { status: "requires_manual_review", manualReviewReason: "high_value" },
      }),
    ).toMatchObject({ state: "in-review", blocker: "review" });
  });

  it("ends as cancelled when the sale was cancelled at fulfilment", async () => {
    expect(await entryFor({ lotId: "a", fulfilment: "cancelled" })).toMatchObject({
      state: "cancelled",
      blocker: null,
    });
  });

  it("treats a defaulted purchase, whose invoice was voided and sale cancelled, as ended", async () => {
    expect(
      await entryFor({ lotId: "a", payment: { status: "cancelled" }, fulfilment: "cancelled" }),
    ).toMatchObject({ state: "cancelled" });
  });

  it.each<PaymentStatus>(["captured", "refunded", "authorized"])(
    "owes nothing on a %s payment",
    async (status) => {
      expect(await entryFor({ lotId: "a", payment: { status } })).toBeNull();
    },
  );

  it("still owes after an abandoned checkout", async () => {
    expect(await entryFor({ lotId: "a", payment: { status: "cancelled" } })).toMatchObject({
      state: "payment-due",
    });
  });

  it("only tells the person about a lot they won for an organisation", async () => {
    expect(await entryFor({ lotId: "a", buyerLegalEntityId: ORG })).toMatchObject({
      role: "informed",
      blocker: null,
    });
  });
});

describe("amounts owed for an organisation", () => {
  it("follows its purchases for the members who see its money", async () => {
    const { service, lotList } = build([{ lotId: "a", buyerLegalEntityId: ORG }]);
    const view = await service.forAccount({
      userId: USER,
      account: { legalEntityId: ORG, role: "finance" },
    });
    expect(view?.entries).toHaveLength(1);
    expect(view?.entries[0]).toMatchObject({ role: "payer", state: "payment-due" });
    expect(lotList).toHaveBeenCalledWith(
      expect.objectContaining({ buyerLegalEntityId: ORG, statuses: ["ended"] }),
    );
  });

  it("tells a buyer agent about their win without asking them to pay", async () => {
    const { service } = build([{ lotId: "a", buyerLegalEntityId: ORG }]);
    const view = await service.forAccount({
      userId: USER,
      account: { legalEntityId: ORG, role: "buyer_agent" },
    });
    expect(view?.entries[0]).toMatchObject({ role: "informed", blocker: null });
  });

  it("is not for a role that does not follow purchases", async () => {
    const { service } = build([{ lotId: "a", buyerLegalEntityId: ORG }]);
    const view = await service.forAccount({
      userId: USER,
      account: { legalEntityId: ORG, role: "viewer" as never },
    });
    expect(view).toBeNull();
  });

  it("reads the person's own account the same as forPerson", async () => {
    const { service } = build([{ lotId: "a" }]);
    const view = await service.forAccount({
      userId: USER,
      account: { legalEntityId: PERSONAL, role: "owner" },
    });
    expect(view?.entries[0]).toMatchObject({ role: "payer", state: "payment-due" });
  });
});

describe("amounts owed inside a part-funded bank transfer", () => {
  const sharing = (shares: [string, number][]): IStillToSendService => ({
    forPayments: async () =>
      new Map(shares.map(([lotId, pence]) => [lotId, { groupId: "group-1", pence }])),
  });

  it("lists what is still to send, and no longer owes the invoice as a payment to start", async () => {
    const { service } = build(
      [{ lotId: "a", payment: { status: "authorized" } }],
      "clear",
      sharing([["a", 30_005]]),
    );
    const view = await service.forPerson(USER);
    expect(view.entries).toEqual([]);
    expect(view.stillToSend).toEqual([{ lotId: "a", groupId: "group-1", pence: 30_005 }]);
  });

  it("asks the reader about the invoices on their way, over the lots read", async () => {
    const forPayments = vi.fn(async () => new Map());
    const { service } = build(
      [
        { lotId: "a", payment: { status: "authorized" } },
        { lotId: "b", payment: { status: "pending" } },
      ],
      "clear",
      { forPayments },
    );
    await service.forPerson(USER);
    expect(forPayments).toHaveBeenCalledWith([
      expect.objectContaining({ id: "pay-a", lotId: "a", status: "authorized" }),
      expect.objectContaining({ id: "pay-b", lotId: "b", status: "pending" }),
    ]);
  });

  it("does not ask someone else's payer to send it", async () => {
    const { service } = build(
      [
        {
          lotId: "a",
          payment: { status: "authorized" },
          buyerLegalEntityId: ORG,
          winnerId: USER,
        },
      ],
      "clear",
      sharing([["a", 30_005]]),
    );
    expect((await service.forPerson(USER)).stillToSend).toEqual([]);
  });

  it("has nothing to send when no transfer is part-funded", async () => {
    const { service } = build([{ lotId: "a", payment: { status: "authorized" } }]);
    expect((await service.forPerson(USER)).stillToSend).toEqual([]);
  });
});
