import type { PaymentEligibility, PaymentTierLimits } from "@auction/domain";
import { AmlSettlementCompliancePolicy, SourceOfFundsGateService } from "@auction/finance-runtime";
import type {
  BidInvoiceRecord,
  IAmlHoldStore,
  ISourceOfFundsRepository,
  PaySeveralInvoiceFlags,
} from "@auction/persistence/interfaces";
import type { InvoiceLine, LegalEntityMemberRole, Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import {
  BUYING_ACCOUNT,
  InMemoryPurchaseFacts,
  LOTS,
  NOW,
  seedPurchases,
} from "../../testing/in-memory-workspace-buying.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import type { GroupCheckoutStatus } from "../payment-group/payment-group-ports.js";
import { PayPlanService } from "./pay-plan.service.js";
import { PayProgressResolver } from "./pay-progress.resolver.js";
import { PurchaseCandidateReader } from "./purchase-candidate.reader.js";

const LIMITS: PaymentTierLimits = {
  minPence: 30,
  cardMaxPence: 1_000_000,
  manualReviewMinPence: 50_000_000,
  absoluteMaxPence: 99_999_999,
};

const NOT_INVOICED = "aaaaaaaa-0000-4000-8000-000000000006";

const actor = (
  role: LegalEntityMemberRole,
  over: Partial<OrganisationMemberActor> = {},
): OrganisationMemberActor => ({
  userId: `${role}-1`,
  legalEntityId: BUYING_ACCOUNT,
  role,
  ...over,
});

const lines = (hammer: number, premium: number): InvoiceLine[] => [
  { kind: "hammer", label: "Hammer price", ratePercent: null, amountPence: hammer },
  {
    kind: "buyers_premium",
    label: "Buyer's premium (25%)",
    ratePercent: "25",
    amountPence: premium,
  },
];

function invoice(id: string, hammer: number, premium: number, over = {}): BidInvoiceRecord {
  return {
    id,
    lotId: "lot",
    buyerLegalEntityId: BUYING_ACCOUNT,
    sellerLegalEntityId: "seller",
    totalPence: hammer + premium,
    raisedAt: new Date("2026-11-18T10:00:00Z"),
    dueAt: new Date("2026-11-25T23:59:59.999Z"),
    pricingPolicyId: "flat:0.25",
    number: null,
    source: "raised",
    voidedAt: null,
    lines: lines(hammer, premium),
    ...over,
  };
}

const STORED = new Map<string, BidInvoiceRecord>([
  ["pay-1", invoice("inv-1", 100_000, 25_000)],
  ["pay-2", invoice("inv-2", 48_008, 12_002, { dueAt: new Date("2026-11-22T23:59:59.999Z") })],
  ["pay-3", invoice("inv-3", 32_000, 8_000)],
  ["pay-4", invoice("inv-4", 24_000, 6_000)],
]);

function build(
  over: {
    onboarding?: boolean | Error;
    eligibility?: PaymentEligibility | Error;
    assess?: ReturnType<typeof vi.fn>;
    compliance?: ConstructorParameters<typeof PayPlanService>[0]["compliance"];
    flags?: Record<string, PaySeveralInvoiceFlags>;
    stored?: Map<string, BidInvoiceRecord>;
    priceTotal?: number;
    accountKind?: "individual" | "organisation";
    facts?: InMemoryPurchaseFacts;
    /** What the payment provider says about a group's checkout; "complete" unless given. */
    checkoutStatus?: GroupCheckoutStatus | Error;
  } = {},
) {
  const price = vi.fn(async (_lot: Lot) => ({
    lines: lines(over.priceTotal ? over.priceTotal : 200_000, over.priceTotal ? 0 : 50_000),
    totalPence: over.priceTotal ?? 250_000,
    policyId: "flat:0.25",
    existing: null,
  }));
  const eligibilityCheck = vi.fn(async () => {
    if (over.eligibility instanceof Error) throw over.eligibility;
    return over.eligibility ?? { kind: "payable" as const };
  });
  const isComplete = vi.fn(async () => {
    if (over.onboarding instanceof Error) throw over.onboarding;
    return over.onboarding ?? true;
  });
  const assess = over.assess ?? vi.fn(async () => ({ hold: false, reason: null }));
  const svc = new PayPlanService({
    // Every live group counts as a payment the payer finished.
    progress: new PayProgressResolver({
      checkoutStatus: async () => {
        if (over.checkoutStatus instanceof Error) throw over.checkoutStatus;
        return over.checkoutStatus ?? "complete";
      },
    }),
    candidates: new PurchaseCandidateReader({
      reader: over.facts ?? new InMemoryPurchaseFacts(),
      flags: {
        flagsFor: async (ids) =>
          new Map(ids.flatMap((id) => (over.flags?.[id] ? [[id, over.flags[id]]] : []))),
      },
      now: () => NOW,
    }),
    invoices: { findByPaymentIds: async () => over.stored ?? STORED },
    pricing: { price },
    lots: {
      findById: vi.fn(async (id: string) => ({ id, buyerLegalEntityId: BUYING_ACCOUNT }) as Lot),
    },
    accounts: {
      findById: async () =>
        ({
          id: BUYING_ACCOUNT,
          displayName: "Northbank Gallery",
          kind: over.accountKind ?? "organisation",
        }) as never,
    },
    onboarding: { isComplete },
    eligibility: { check: eligibilityCheck },
    compliance: over.compliance === undefined ? { assess } : over.compliance,
    limits: LIMITS,
    issuer: {
      name: "London Auction Xchange LTD",
      address: "156 New Cavendish Street, Marylebone, London W1W 6YW, United Kingdom",
      companyNumber: null,
      vatNumber: null,
    },
    now: () => NOW,
  });
  return { svc, price, assess, eligibilityCheck, isComplete };
}

describe("PayPlanService.plan", () => {
  it("lists the stored lines of each payable invoice, the total and the company issuing them", async () => {
    const plan = (
      await build().svc.plan(actor("finance"), [LOTS.due, LOTS.overdue])
    )._unsafeUnwrap();
    expect(plan.payable.map((p) => [p.lotId, p.paymentId, p.invoiceId, p.totalPence])).toEqual([
      [LOTS.due, "pay-2", "inv-2", 60_010],
      [LOTS.overdue, "pay-3", "inv-3", 40_000],
    ]);
    expect(plan.payable[0]?.lines).toEqual(lines(48_008, 12_002));
    expect(plan.totals.pence).toBe(100_010);
    expect(plan.gate).toEqual({ kind: "clear" });
    expect(plan.account).toEqual({
      legalEntityId: BUYING_ACCOUNT,
      kind: "organisation",
      name: "Northbank Gallery",
    });
    expect(plan.entity.name).toBe("London Auction Xchange LTD");
    expect(plan.firstDueAt).toBe("2026-11-22T23:59:59.999Z");
    expect(plan.methods[0]).toMatchObject({ method: "card", available: true });
  });

  it("uses the stored due date and says when an invoice is overdue", async () => {
    const plan = (await build().svc.plan(actor("owner"), [LOTS.overdue]))._unsafeUnwrap();
    expect(plan.payable[0]?.dueAt).toBe("2026-11-25T23:59:59.999Z");
  });

  it("leaves out paid, other accounts' and held lots, with the reason", async () => {
    const { svc } = build({
      flags: {
        "pay-2": { heldForReview: true, inPaymentInProgress: false, group: null },
        "pay-3": {
          heldForReview: false,
          inPaymentInProgress: true,
          group: {
            id: "group-9",
            status: "open",
            checkoutRail: "card",
            stripeCheckoutSessionId: "cs_9",
            totalAmount: "100.00",
            amountReceived: "0.00",
          },
        },
      },
    });
    const plan = (
      await svc.plan(actor("owner"), [
        LOTS.paid,
        LOTS.due,
        LOTS.overdue,
        LOTS.otherAccount,
        LOTS.agentWin,
      ])
    )._unsafeUnwrap();
    expect(plan.payable.map((p) => p.lotId)).toEqual([LOTS.agentWin]);
    expect(plan.leftOut).toEqual([
      { lotId: LOTS.paid, reason: "paid" },
      { lotId: LOTS.due, reason: "held_for_review" },
      { lotId: LOTS.overdue, reason: "being_paid" },
      { lotId: LOTS.otherAccount, reason: "other_account" },
    ]);
  });

  it("describes nothing about a lot that is not this account's", async () => {
    const plan = (
      await build().svc.plan(actor("owner"), [
        LOTS.otherAccount,
        "aaaaaaaa-0000-4000-8000-0000000000ff",
      ])
    )._unsafeUnwrap();
    expect(plan.leftOut).toEqual([
      { lotId: LOTS.otherAccount, reason: "other_account" },
      { lotId: "aaaaaaaa-0000-4000-8000-0000000000ff", reason: "other_account" },
    ]);
  });

  describe("a lot won but not invoiced yet", () => {
    const facts = (winner = { userId: "owner-1", name: "Maya Okafor" }) =>
      new InMemoryPurchaseFacts([
        ...seedPurchases(),
        {
          account: BUYING_ACCOUNT,
          lotId: NOT_INVOICED,
          buyerAccountKind: "organisation",
          lotTitle: "Lot 6",
          lotNumber: 6,
          saleId: "sale-1",
          saleTitle: "Spring Modern British",
          hammerPrice: "2000.00",
          wonBy: winner,
          wonAt: new Date(NOW.getTime() - 86_400_000),
          payment: null,
          fulfilment: null,
          quote: null,
        },
      ]);

    it("is priced as it would be invoiced, counts in the total and has no payment yet", async () => {
      const { svc, price } = build({ facts: facts() });
      const plan = (await svc.plan(actor("owner"), [LOTS.due, NOT_INVOICED]))._unsafeUnwrap();
      expect(price).toHaveBeenCalledTimes(1);
      expect(plan.payable.map((p) => [p.lotId, p.paymentId, p.invoiceId, p.totalPence])).toEqual([
        [LOTS.due, "pay-2", "inv-2", 60_010],
        [NOT_INVOICED, null, null, 250_000],
      ]);
      expect(plan.totals.pence).toBe(310_010);
      // The due date it would get if invoiced now: the end of the London day a week on.
      expect(plan.payable[1]?.dueAt).toBe("2026-11-27T23:59:59.999Z");
    });

    it("is priced for someone who does not pay, who sees it without Pay", async () => {
      const { svc, price } = build({
        facts: facts({ userId: "buyer_agent-1", name: "Tom Whitfield" }),
      });
      const plan = (await svc.plan(actor("buyer_agent"), [NOT_INVOICED]))._unsafeUnwrap();
      expect(price).toHaveBeenCalledTimes(1);
      expect(plan.gate.kind).toBe("not_payer");
      expect(plan.payable.map((p) => [p.lotId, p.paymentId, p.totalPence])).toEqual([
        [NOT_INVOICED, null, 250_000],
      ]);
      expect(plan.totals.pence).toBe(250_000);
      expect(plan.firstDueAt).not.toBeNull();
    });

    it("is left out when its total cannot be paid online", async () => {
      const { svc } = build({ facts: facts(), priceTotal: 100_000_000 });
      const plan = (await svc.plan(actor("owner"), [NOT_INVOICED]))._unsafeUnwrap();
      expect(plan.payable).toEqual([]);
      expect(plan.leftOut).toEqual([{ lotId: NOT_INVOICED, reason: "held_for_review" }]);
    });

    it("fails, rather than guess a price, when it cannot be priced", async () => {
      const f = facts();
      const { svc, price } = build({ facts: f });
      price.mockRejectedValueOnce(new Error("sale not found"));
      const result = await svc.plan(actor("owner"), [NOT_INVOICED]);
      expect(result._unsafeUnwrapErr()).toMatchObject({
        code: "pay_plan_unavailable",
        status: 503,
      });
    });
  });

  describe("the gate", () => {
    it("a buyer agent is shown who pays, and no other check is made", async () => {
      const { svc, eligibilityCheck, isComplete, assess } = build();
      const plan = (await svc.plan(actor("buyer_agent"), [LOTS.agentWin]))._unsafeUnwrap();
      expect(plan.payerRole).toBe("informed");
      expect(plan.gate).toEqual({ kind: "not_payer", payingAccountName: "Northbank Gallery" });
      // They still see what they won, with its stored lines, totals and due date.
      expect(plan.payable.map((p) => [p.lotId, p.totalPence])).toEqual([[LOTS.agentWin, 30_000]]);
      expect(plan.totals.pence).toBe(30_000);
      expect(plan.leftOut).toEqual([]);
      expect(isComplete).not.toHaveBeenCalled();
      expect(eligibilityCheck).not.toHaveBeenCalled();
      expect(assess).not.toHaveBeenCalled();
    });

    it("an impersonating admin does not pay", async () => {
      const plan = (
        await build().svc.plan(actor("owner", { isImpersonation: true }), [LOTS.due])
      )._unsafeUnwrap();
      expect(plan.gate.kind).toBe("not_payer");
    });

    it("an account that has not finished onboarding is told so, and the account rule is not read", async () => {
      const { svc, eligibilityCheck } = build({ onboarding: false });
      const plan = (await svc.plan(actor("owner"), [LOTS.due]))._unsafeUnwrap();
      expect(plan.gate).toEqual({ kind: "onboarding_required" });
      expect(plan.payable).toHaveLength(1);
      expect(eligibilityCheck).not.toHaveBeenCalled();
    });

    it("reports a closed organisation as refused and an account under review as held", async () => {
      const refused = build({ eligibility: { kind: "refused", reason: "organisation_closed" } });
      expect((await refused.svc.plan(actor("owner"), [LOTS.due]))._unsafeUnwrap().gate).toEqual({
        kind: "refused",
        reason: "organisation_closed",
      });
      const held = build({
        eligibility: { kind: "held", reason: "identity_verification_required" },
      });
      const plan = (await held.svc.plan(actor("owner"), [LOTS.due]))._unsafeUnwrap();
      expect(plan.gate).toEqual({ kind: "held", reason: "identity_verification_required" });
      expect(held.assess).not.toHaveBeenCalled();
    });

    it("reports a personal account the same way as an organisation", async () => {
      const plan = (
        await build({ accountKind: "individual" }).svc.plan(actor("owner"), [LOTS.due])
      )._unsafeUnwrap();
      expect(plan.account.kind).toBe("individual");
      expect(plan.gate).toEqual({ kind: "clear" });
    });

    it("asks about the payer on the total and each winner on what they won, leaving the invoices out of their exposure", async () => {
      const { svc, assess } = build();
      await svc.plan(actor("owner"), [LOTS.due, LOTS.agentWin]);
      expect(assess).toHaveBeenCalledWith({
        buyerUserId: "owner-1",
        amountPence: 90_010,
        excludePaymentIds: ["pay-2", "pay-4"],
      });
      expect(assess).toHaveBeenCalledWith({
        buyerUserId: "buyer_agent-1",
        amountPence: 30_000,
        excludePaymentIds: ["pay-2", "pay-4"],
      });
    });

    it("says which side is held: the payer or the winner", async () => {
      const payer = build({
        assess: vi.fn(async () => ({ hold: true, reason: "aml_hold" as const })),
      });
      expect((await payer.svc.plan(actor("owner"), [LOTS.due]))._unsafeUnwrap().gate).toEqual({
        kind: "compliance",
        reason: "aml_hold",
        subject: "payer",
      });
      const winner = build({
        assess: vi.fn(async (input: { buyerUserId: string }) =>
          input.buyerUserId === "buyer_agent-1"
            ? { hold: true, reason: "source_of_funds_required" as const }
            : { hold: false, reason: null },
        ),
      });
      expect(
        (await winner.svc.plan(actor("owner"), [LOTS.due, LOTS.agentWin]))._unsafeUnwrap().gate,
      ).toEqual({ kind: "compliance", reason: "source_of_funds_required", subject: "winner" });
    });

    it("asks for the finance check on a large total", async () => {
      const { svc } = build({
        stored: new Map([["pay-2", invoice("inv-2", 40_000_000, 10_000_000)]]),
      });
      const plan = (await svc.plan(actor("owner"), [LOTS.due]))._unsafeUnwrap();
      expect(plan.gate).toEqual({ kind: "finance_check" });
    });
  });

  describe("fails closed", () => {
    it.each([
      ["the onboarding check", { onboarding: new Error("db down") }],
      ["the account rule", { eligibility: new Error("db down") }],
      ["the compliance check", { assess: vi.fn(async () => Promise.reject(new Error("db down"))) }],
    ])("when %s cannot be read, the plan is unavailable and never clear", async (_name, over) => {
      const result = await build(over).svc.plan(actor("owner"), [LOTS.due]);
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toMatchObject({
        code: "pay_plan_unavailable",
        status: 503,
      });
    });

    it("when a payment has no stored invoice", async () => {
      const result = await build({ stored: new Map() }).svc.plan(actor("owner"), [LOTS.due]);
      expect(result._unsafeUnwrapErr()).toMatchObject({
        code: "pay_plan_unavailable",
        status: 503,
      });
    });
  });

  describe("only reads", () => {
    const holdStore: IAmlHoldStore = {
      setHold: vi.fn(),
      clearHold: vi.fn(),
      getHold: async () => null,
    };

    function realPolicy(linkedPence: number) {
      const create = vi.fn();
      const repo = {
        sumActiveBuyerSettlementPence: async () => linkedPence,
        findLatestApprovedForUser: async () => null,
        findPendingForUser: async () => null,
        create,
      } as unknown as ISourceOfFundsRepository;
      const gate = new SourceOfFundsGateService(repo, {
        thresholdAmount: 9000,
        currency: "GBP",
        approvalValidityDays: 365,
      });
      const policy = new AmlSettlementCompliancePolicy(holdStore, gate);
      return { policy, create, evaluate: vi.spyOn(policy, "evaluate") };
    }

    it("shows source of funds required when the exposure crosses the threshold, where peek would say clear, and opens no case", async () => {
      const { policy, create, evaluate } = realPolicy(850_000);
      const { svc } = build({ compliance: policy });
      const plan = (await svc.plan(actor("owner"), [LOTS.due]))._unsafeUnwrap();
      expect(plan.gate).toEqual({
        kind: "compliance",
        reason: "source_of_funds_required",
        subject: "payer",
      });
      // Nothing is pending, so the amount-independent peek is clear.
      expect(await policy.peek("owner-1")).toEqual({ hold: false, reason: null });
      expect(create).not.toHaveBeenCalled();
      expect(evaluate).not.toHaveBeenCalled();
    });

    it("is clear below the threshold", async () => {
      const { policy, create } = realPolicy(0);
      const plan = (
        await build({ compliance: policy }).svc.plan(actor("owner"), [LOTS.due])
      )._unsafeUnwrap();
      expect(plan.gate).toEqual({ kind: "clear" });
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe("the pick", () => {
    it.each([
      ["nothing", [], "pay_several_empty"],
      [
        "21 lots",
        Array.from(
          { length: 21 },
          (_, i) => `aaaaaaaa-0000-4000-8000-0000000001${String(i).padStart(2, "0")}`,
        ),
        "pay_several_too_many",
      ],
      ["a lot twice", [LOTS.due, LOTS.due], "pay_several_duplicate"],
    ])("refuses %s before reading anything", async (_name, lotIds, code) => {
      const { svc, isComplete } = build();
      const result = await svc.plan(actor("owner"), lotIds);
      expect(result._unsafeUnwrapErr()).toMatchObject({ code, status: 400 });
      expect(isComplete).not.toHaveBeenCalled();
    });

    it("reads one lot and twenty lots", async () => {
      const lots = Array.from(
        { length: 20 },
        (_, i) => `aaaaaaaa-0000-4000-8000-0000000002${String(i).padStart(2, "0")}`,
      );
      expect((await build().svc.plan(actor("owner"), lots)).isOk()).toBe(true);
      expect((await build().svc.plan(actor("owner"), [LOTS.due])).isOk()).toBe(true);
    });
  });
});

describe("PayPlanService.plan: a payment already under way", () => {
  const group = (over: Record<string, unknown> = {}) => ({
    id: "group-9",
    status: "open" as const,
    checkoutRail: "gb_bank_transfer" as const,
    stripeCheckoutSessionId: "cs_9",
    totalAmount: "1000.10",
    amountReceived: "0.00",
    ...over,
  });
  const flags = (g: ReturnType<typeof group>) => ({
    "pay-2": { heldForReview: false, inPaymentInProgress: true, group: g },
    "pay-3": { heldForReview: false, inPaymentInProgress: true, group: g },
  });

  it("offers the invoices again when the payer never finished the checkout", async () => {
    const { svc } = build({ flags: flags(group()), checkoutStatus: "open" });
    const plan = (await svc.plan(actor("finance"), [LOTS.due, LOTS.overdue]))._unsafeUnwrap();
    expect(plan.payable.map((p) => p.lotId)).toEqual([LOTS.due, LOTS.overdue]);
    expect(plan.progress).toBeNull();
  });

  it("offers them again when the checkout ran out", async () => {
    const { svc } = build({ flags: flags(group()), checkoutStatus: "expired" });
    const plan = (await svc.plan(actor("finance"), [LOTS.due, LOTS.overdue]))._unsafeUnwrap();
    expect(plan.payable).toHaveLength(2);
    expect(plan.progress).toBeNull();
  });

  it("holds the invoices and reports a bank transfer waiting for its money once it is chosen", async () => {
    const { svc } = build({ flags: flags(group()), checkoutStatus: "complete" });
    const plan = (await svc.plan(actor("finance"), [LOTS.due, LOTS.overdue]))._unsafeUnwrap();
    expect(plan.payable).toEqual([]);
    expect(plan.leftOut.map((l) => l.reason)).toEqual(["being_paid", "being_paid"]);
    expect(plan.progress).toEqual({
      rail: "bank_transfer",
      stage: "awaiting_transfer",
      lots: [
        expect.objectContaining({ lotId: LOTS.due }),
        expect.objectContaining({ lotId: LOTS.overdue }),
      ],
      totalPence: 100_010,
      receivedPence: 0,
      remainingPence: 100_010,
      receivedPercent: 0,
    });
  });

  it("reports what has arrived of a part-funded transfer", async () => {
    const { svc } = build({
      flags: flags(group({ status: "processing", amountReceived: "600.10" })),
    });
    const plan = (await svc.plan(actor("finance"), [LOTS.due, LOTS.overdue]))._unsafeUnwrap();
    expect(plan.progress).toMatchObject({
      stage: "part_received",
      receivedPence: 60_010,
      remainingPence: 40_000,
      receivedPercent: 60,
    });
  });

  it("holds the invoices rather than offering them when the provider cannot be asked", async () => {
    const { svc } = build({
      flags: flags(group({ checkoutRail: "card" })),
      checkoutStatus: new Error("network"),
    });
    const plan = (await svc.plan(actor("finance"), [LOTS.due, LOTS.overdue]))._unsafeUnwrap();
    expect(plan.payable).toEqual([]);
    expect(plan.progress).toMatchObject({ rail: "card", stage: "confirming" });
  });

  it("carries the card limit from the server's limits and bank transfer for any amount", async () => {
    const plan = (
      await build().svc.plan(actor("finance"), [LOTS.due, LOTS.overdue])
    )._unsafeUnwrap();
    expect(plan.cardLimitPence).toBe(LIMITS.cardMaxPence);
    expect(plan.methods).toEqual([
      { method: "card", available: true, reason: null },
      { method: "bank_transfer", available: true, reason: null },
    ]);
  });
});
