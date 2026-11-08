import { PURCHASE_LIST_LIMIT, type PaymentEligibility } from "@auction/domain";
import type { PaymentStatus } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
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

type OrganisationChecks = {
  eligibility?: PaymentEligibility;
  /** What the compliance assessment says for the subjects it is asked about. */
  assess?: (input: { buyerUserId: string; amountPence: number }) => {
    hold: boolean;
    reason: "aml_hold" | "source_of_funds_required" | null;
  };
};

function build(
  fixtures: Fixture[],
  gate: "clear" | "aml_hold" | "source_of_funds_required" = "clear",
  checks: OrganisationChecks = {},
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
  const eligibilityCheck = vi.fn(async () => checks.eligibility ?? { kind: "payable" as const });
  const assess = vi.fn(async (input: { buyerUserId: string; amountPence: number }) =>
    (checks.assess ?? (() => ({ hold: false, reason: null })))(input),
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
    personalAccount: { idFor: async () => PERSONAL },
    organisationChecks: {
      eligibility: { check: eligibilityCheck },
      compliance: { assess: assess as never },
    },
  });
  return { service, lotList, eligibilityCheck, assess };
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

describe("what holds an organisation's purchases: the Pay page plan's own checks", () => {
  const asFinance = (
    service: ReturnType<typeof build>["service"],
    userId = USER,
  ): ReturnType<typeof service.forAccount> =>
    service.forAccount({ userId, account: { legalEntityId: ORG, role: "finance" } });
  const orgLot = (over: Partial<Fixture> = {}): Fixture => ({
    lotId: "a",
    buyerLegalEntityId: ORG,
    winnerId: "winner-1",
    ...over,
  });

  it("is clear when the organisation and the checks are clear, whatever the person's own gate says", async () => {
    // The signed-in person has an open source-of-funds case of their own; acting for the
    // organisation, what holds a purchase is the organisation's payer and winner checks.
    const { service } = build([orgLot()], "source_of_funds_required");
    const view = await asFinance(service);
    expect(view?.entries[0]).toMatchObject({
      state: "payment-due",
      blocker: null,
      holder: null,
    });
  });

  it("is held by the organisation while LAX is still checking it, with nothing for the payer to upload", async () => {
    const { service, assess } = build([orgLot()], "clear", {
      eligibility: { kind: "held", reason: "organisation_under_review" },
    });
    const view = await asFinance(service);
    expect(view?.entries[0]).toMatchObject({
      state: "in-review",
      blocker: "review",
      holder: "organisation",
    });
    expect(assess).not.toHaveBeenCalled();
  });

  it("is held by the organisation when it is closed too", async () => {
    const { service } = build([orgLot()], "clear", {
      eligibility: { kind: "refused", reason: "organisation_closed" },
    });
    expect((await asFinance(service))?.entries[0]).toMatchObject({
      state: "in-review",
      holder: "organisation",
    });
  });

  it("is held by the payer's own source-of-funds check, which they can answer with documents", async () => {
    const { service } = build([orgLot()], "clear", {
      assess: ({ buyerUserId }) =>
        buyerUserId === USER
          ? { hold: true, reason: "source_of_funds_required" }
          : { hold: false, reason: null },
    });
    expect((await asFinance(service))?.entries[0]).toMatchObject({
      state: "in-review",
      blocker: "documents",
      holder: "payer",
    });
  });

  it("is held by the winner's check, which the payer can only wait for", async () => {
    const { service } = build([orgLot()], "clear", {
      assess: ({ buyerUserId }) =>
        buyerUserId === "winner-1"
          ? { hold: true, reason: "source_of_funds_required" }
          : { hold: false, reason: null },
    });
    expect((await asFinance(service))?.entries[0]).toMatchObject({
      state: "in-review",
      blocker: "review",
      holder: "winner",
    });
  });

  it("checks the payer on everything they pay, and each winner on what they won", async () => {
    const { service, assess } = build([
      orgLot({ lotId: "a", winnerId: "winner-1" }),
      orgLot({ lotId: "b", winnerId: USER }),
    ]);
    await asFinance(service);
    const asked = assess.mock.calls.map(([input]) => [input.buyerUserId, input.amountPence]);
    expect(asked).toEqual([
      [USER, 230_000],
      ["winner-1", 115_000],
    ]);
  });

  it("asks nothing of the checks when nothing is owed, or when the person only follows the purchase", async () => {
    const none = build([orgLot({ payment: { status: "captured" } })]);
    await asFinance(none.service);
    expect(none.assess).not.toHaveBeenCalled();
    expect(none.eligibilityCheck).not.toHaveBeenCalled();
    const informed = build([orgLot()]);
    await informed.service.forAccount({
      userId: USER,
      account: { legalEntityId: ORG, role: "buyer_agent" },
    });
    expect(informed.assess).not.toHaveBeenCalled();
  });

  it("holds a personal purchase by the person's own gate, as before", async () => {
    expect(await entryFor({ lotId: "a" }, "source_of_funds_required")).toMatchObject({
      state: "in-review",
      blocker: "documents",
      holder: "payer",
    });
    expect(await entryFor({ lotId: "a" }, "aml_hold")).toMatchObject({
      blocker: "review",
      holder: "payer",
    });
    expect(await entryFor({ lotId: "a" })).toMatchObject({ holder: null });
  });
});
