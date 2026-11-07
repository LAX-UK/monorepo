import type { PaymentEligibility, PaymentTierLimits } from "@auction/domain";
import { AmlSettlementCompliancePolicy, SourceOfFundsGateService } from "@auction/finance-runtime";
import type {
  AccountPurchaseFactsRow,
  BidInvoiceRecord,
  PaySeveralInvoiceFlags,
} from "@auction/persistence/interfaces";
import type { InvoiceLine, LegalEntityMemberRole, Lot, PaymentStatus } from "@auction/types";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import {
  BUYING_ACCOUNT,
  InMemoryPurchaseFacts,
  LOTS,
  NOW,
  seedPurchases,
} from "../../testing/in-memory-workspace-buying.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import { PayPlanService } from "./pay-plan.service.js";
import { PaySeveralService } from "./pay-several.service.js";
import { PurchaseCandidateReader } from "./purchase-candidate.reader.js";

const LIMITS: PaymentTierLimits = {
  minPence: 30,
  cardMaxPence: 500_000,
  manualReviewMinPence: 2_500_000,
  absoluteMaxPence: 10_000_000,
};

/** Pays the plan the person was shown for these lots, as the screen does. */
async function payShown(
  svc: Pick<PaySeveralService, "plan" | "pay">,
  who: OrganisationMemberActor,
  lots: readonly string[],
  expected?: { expectedTotalPence: number; expectedLotIds: readonly string[] },
) {
  const shown = await svc.plan(who, lots);
  const fromPlan = shown.isOk()
    ? {
        expectedTotalPence: Math.round(Number(shown.value.total) * 100),
        expectedLotIds: shown.value.payable.map((p) => p.lotId),
      }
    : { expectedTotalPence: 1, expectedLotIds: [lots[0] as string] };
  return svc.pay(who, { lotIds: lots, ...(expected ?? fromPlan) });
}

const NOT_INVOICED = "aaaaaaaa-0000-4000-8000-000000000006";
const NOT_INVOICED_TOTAL = 250_000;

const actor = (
  role: LegalEntityMemberRole,
  over: Partial<OrganisationMemberActor> = {},
): OrganisationMemberActor => ({
  userId: `${role}-1`,
  legalEntityId: BUYING_ACCOUNT,
  role,
  ...over,
});

const hammerAndPremium = (total: number): InvoiceLine[] => {
  const hammer = Math.round(total / 1.25);
  return [
    { kind: "hammer", label: "Hammer price", ratePercent: null, amountPence: hammer },
    {
      kind: "buyers_premium",
      label: "Buyer's premium (25%)",
      ratePercent: "25",
      amountPence: total - hammer,
    },
  ];
};

function storedInvoice(row: AccountPurchaseFactsRow, totalPence: number): BidInvoiceRecord {
  return {
    id: `inv-${row.payment?.id}`,
    lotId: row.lotId,
    buyerLegalEntityId: BUYING_ACCOUNT,
    sellerLegalEntityId: "seller",
    totalPence,
    raisedAt: NOW,
    dueAt: new Date("2026-11-27T23:59:59.999Z"),
    pricingPolicyId: "flat:0.25",
    number: null,
    source: "raised",
    voidedAt: null,
    lines: hammerAndPremium(totalPence),
  } as BidInvoiceRecord;
}

type World = {
  /** What raising the not-invoiced lot does to the payment. */
  raiseStatus?: PaymentStatus;
  raiseFails?: boolean;
  /** Leave the lot without an invoice, as when the lot-end guards refuse it. */
  raiseCreatesNothing?: boolean;
  /** What the raised invoice totals, as a decimal string (default £2,500.00). */
  raiseAmount?: string;
  /** Another payment starts on these invoices while this one is raising. */
  flagsAfterRaise?: Record<string, PaySeveralInvoiceFlags>;
  flags?: Record<string, PaySeveralInvoiceFlags>;
  limits?: PaymentTierLimits;
  peekHold?: boolean;
  assessHold?: boolean;
  evaluateHold?: boolean;
  /** Only this person is on hold (the payer or a lot's winner). */
  holdFor?: string;
  eligibility?: PaymentEligibility;
  start?: ReturnType<typeof vi.fn>;
  withNotInvoiced?: boolean;
  metrics?: { record: (event: string) => void };
};

function service(over: World = {}) {
  const rows = over.withNotInvoiced
    ? [
        ...seedPurchases(),
        {
          account: BUYING_ACCOUNT,
          lotId: NOT_INVOICED,
          buyerAccountKind: "organisation" as const,
          lotTitle: "Lot 6",
          lotNumber: 6,
          saleId: "sale-1",
          saleTitle: "Spring Modern British",
          hammerPrice: "2000.00",
          wonBy: { userId: "owner-1", name: "Maya Okafor" },
          wonAt: new Date(NOW.getTime() - 86_400_000),
          payment: null,
          fulfilment: null,
          quote: null,
        },
      ]
    : seedPurchases();
  const facts = new InMemoryPurchaseFacts(rows);
  const stored = new Map<string, BidInvoiceRecord>();
  const store = () => {
    for (const row of rows) {
      const payment = row.payment;
      if (payment && !stored.has(payment.id)) {
        stored.set(payment.id, storedInvoice(row, Math.round(Number(payment.amount) * 100)));
      }
    }
  };
  store();

  // Raising a lot's invoice, as the lot-end path does: once, whoever asks first.
  const ensureForLot = vi.fn(async (lotId: string) => {
    if (over.raiseFails) throw new Error("database unavailable");
    const row = rows.find((r) => r.lotId === lotId);
    if (!row) return { created: false, reason: "lot_not_found", lotId };
    if (row.payment) return { created: false, reason: "payment_already_exists", lotId };
    if (over.raiseCreatesNothing) return { created: false, reason: "lot_not_ended", lotId };
    row.payment = {
      id: "pay-new",
      status: over.raiseStatus ?? "pending",
      amount: over.raiseAmount ?? "2500.00",
      raisedAt: NOW,
      dueAt: null,
    };
    store();
    if (over.flagsAfterRaise) over.flags = { ...over.flags, ...over.flagsAfterRaise };
    return { created: true, paymentId: "pay-new", lotId };
  });

  const start =
    over.start ??
    vi.fn(async (input: { rail: string }) =>
      ok({ paymentGroupId: "group-1", checkoutUrl: "https://pay.example/g1", rail: input.rail }),
    );
  const evaluate = vi.fn(async (input: { buyerUserId: string }) => ({
    hold: over.evaluateHold ?? input.buyerUserId === over.holdFor,
    reason: null,
  }));
  const assess = vi.fn(async () =>
    over.assessHold
      ? { hold: true, reason: "source_of_funds_required" as const }
      : { hold: false, reason: null },
  );
  const price = vi.fn(async (_lot: Lot) => ({
    lines: hammerAndPremium(NOT_INVOICED_TOTAL),
    totalPence: NOT_INVOICED_TOTAL,
    policyId: "flat:0.25",
    existing: null,
  }));
  const limits = over.limits ?? LIMITS;
  const planner = new PayPlanService({
    candidates: new PurchaseCandidateReader({
      reader: facts,
      flags: {
        flagsFor: async (ids) =>
          new Map(ids.flatMap((id) => (over.flags?.[id] ? [[id, over.flags[id]]] : []))),
      },
      now: () => NOW,
    }),
    invoices: { findByPaymentIds: async () => stored },
    pricing: { price },
    lots: { findById: async (id: string) => ({ id, buyerLegalEntityId: BUYING_ACCOUNT }) as Lot },
    accounts: {
      findById: async () =>
        ({ id: BUYING_ACCOUNT, displayName: "Northbank Gallery", kind: "organisation" }) as never,
    },
    onboarding: { isComplete: async () => true },
    eligibility: { check: vi.fn(async () => over.eligibility ?? { kind: "payable" as const }) },
    compliance: { assess },
    limits,
    issuer: {
      name: "London Auction Xchange LTD",
      address: "156 New Cavendish Street",
      companyNumber: null,
      vatNumber: null,
    },
    now: () => NOW,
  });
  const svc = new PaySeveralService({
    planner,
    invoices: { ensureForLot },
    limits,
    compliance: { evaluate },
    checkout: { start },
    ...(over.metrics ? { metrics: over.metrics } : {}),
  });
  return { svc, planner, start, evaluate, ensureForLot, price };
}

describe("PaySeveralService.plan", () => {
  it("plans one payment over the owed invoices, skips the rest with reasons, and picks the rail", async () => {
    const plan = (
      await service().svc.plan(actor("finance"), [
        LOTS.due,
        LOTS.overdue,
        LOTS.paid,
        LOTS.otherAccount,
      ])
    )._unsafeUnwrap();
    expect(plan.payable).toEqual([
      { lotId: LOTS.due, totalDue: "600.10" },
      { lotId: LOTS.overdue, totalDue: "400.00" },
    ]);
    expect(plan.total).toBe("1000.10");
    expect(plan.skipped).toEqual([
      { lotId: LOTS.paid, reason: "not_owed" },
      { lotId: LOTS.otherAccount, reason: "other_account" },
    ]);
    expect(plan.payTogether).toEqual({ allowed: true, rail: "card" });
  });

  it("leaves out invoices held for review or already in another payment, saying why", async () => {
    const { svc } = service({
      flags: {
        "pay-2": { heldForReview: true, inPaymentInProgress: false },
        "pay-3": { heldForReview: false, inPaymentInProgress: true },
      },
    });
    const plan = (
      await svc.plan(actor("owner"), [LOTS.due, LOTS.overdue, LOTS.agentWin])
    )._unsafeUnwrap();
    expect(plan.payable.map((p) => p.lotId)).toEqual([LOTS.agentWin]);
    expect(plan.skipped).toEqual([
      { lotId: LOTS.due, reason: "held_for_review" },
      { lotId: LOTS.overdue, reason: "being_paid" },
    ]);
  });

  it("works out the rail and the limits on the total, not on each invoice", async () => {
    // Each invoice alone is under the card limit; together they go by bank transfer.
    const bank = service({ limits: { ...LIMITS, cardMaxPence: 70_000 } });
    expect(
      (await bank.svc.plan(actor("owner"), [LOTS.due, LOTS.overdue]))._unsafeUnwrap().payTogether,
    ).toEqual({ allowed: true, rail: "gb_bank_transfer" });
    // Together they reach the review threshold, so they cannot be paid at once.
    const review = service({ limits: { ...LIMITS, manualReviewMinPence: 100_000 } });
    expect(
      (await review.svc.plan(actor("owner"), [LOTS.due, LOTS.overdue]))._unsafeUnwrap().payTogether,
    ).toEqual({ allowed: false, reason: "needs_finance_review" });
  });

  it("says when a check on the amount stops the payment, without opening one", async () => {
    const { svc, evaluate } = service({ assessHold: true });
    const plan = (await svc.plan(actor("owner"), [LOTS.due]))._unsafeUnwrap();
    expect(plan.payTogether).toEqual({ allowed: false, reason: "payer_on_hold" });
    expect(evaluate).not.toHaveBeenCalled();
  });

  it("counts a lot that is not invoiced yet, as the pay plan does", async () => {
    const { svc, planner } = service({ withNotInvoiced: true });
    const quote = (await svc.plan(actor("owner"), [LOTS.due, NOT_INVOICED]))._unsafeUnwrap();
    const plan = (await planner.plan(actor("owner"), [LOTS.due, NOT_INVOICED]))._unsafeUnwrap();
    expect(quote.total).toBe("3100.10");
    expect(quote.payable.map((p) => p.lotId)).toEqual(plan.payable.map((p) => p.lotId));
  });

  it("refuses a buyer agent and an impersonating admin: they do not move the account's money", async () => {
    const { svc } = service();
    expect((await svc.plan(actor("buyer_agent"), [LOTS.agentWin]))._unsafeUnwrapErr().code).toBe(
      "pay_several_nothing_payable",
    );
    expect(
      (await svc.plan(actor("owner", { isImpersonation: true }), [LOTS.due]))._unsafeUnwrapErr()
        .code,
    ).toBe("pay_several_nothing_payable");
  });
});

describe("PaySeveralService.pay", () => {
  it("opens one checkout for the payable invoices, by their payments and amounts", async () => {
    const { svc, start, evaluate, ensureForLot } = service();
    const started = (
      await payShown(svc, actor("finance"), [LOTS.due, LOTS.overdue, LOTS.paid])
    )._unsafeUnwrap();
    expect(ensureForLot).not.toHaveBeenCalled();
    expect(start).toHaveBeenCalledWith({
      payerUserId: "finance-1",
      buyerLegalEntityId: BUYING_ACCOUNT,
      currency: "GBP",
      total: "1000.10",
      rail: "card",
      invoices: [
        { paymentId: "pay-2", lotId: LOTS.due, amount: "600.10" },
        { paymentId: "pay-3", lotId: LOTS.overdue, amount: "400.00" },
      ],
    });
    expect(evaluate).toHaveBeenCalledWith({
      buyerUserId: "finance-1",
      amountPence: 100_010,
      excludePaymentIds: ["pay-2", "pay-3"],
    });
    expect(started).toMatchObject({
      paymentGroupId: "group-1",
      checkoutUrl: "https://pay.example/g1",
      total: "1000.10",
      skipped: [{ lotId: LOTS.paid, reason: "not_owed" }],
    });
  });

  it("refuses roles that do not pay, before anything is raised or held", async () => {
    for (const role of ["buyer_agent", "viewer", "consignor"] as const) {
      const { svc, start, ensureForLot } = service({ withNotInvoiced: true });
      expect((await payShown(svc, actor(role), [NOT_INVOICED]))._unsafeUnwrapErr()).toMatchObject({
        code: "insufficient_entity_role",
        status: 403,
      });
      expect(ensureForLot).not.toHaveBeenCalled();
      expect(start).not.toHaveBeenCalled();
    }
  });

  it("refuses a total that cannot be paid at once, saying why, and holds nothing", async () => {
    const { svc, start } = service({ limits: { ...LIMITS, manualReviewMinPence: 100_000 } });
    expect(
      (await payShown(svc, actor("owner"), [LOTS.due, LOTS.overdue]))._unsafeUnwrapErr(),
    ).toMatchObject({ code: "pay_several_needs_finance_review", status: 409 });
    expect(start).not.toHaveBeenCalled();
  });

  it("refuses when the compliance check on the total holds the payer", async () => {
    const { svc, start } = service({ evaluateHold: true });
    expect((await payShown(svc, actor("owner"), [LOTS.due]))._unsafeUnwrapErr().code).toBe(
      "pay_several_payer_on_hold",
    );
    expect(start).not.toHaveBeenCalled();
  });

  it("opens the check when the plan says one is needed, before raising any invoice", async () => {
    const { svc, evaluate, ensureForLot, start } = service({
      assessHold: true,
      evaluateHold: true,
      withNotInvoiced: true,
    });
    expect((await payShown(svc, actor("owner"), [NOT_INVOICED]))._unsafeUnwrapErr().code).toBe(
      "pay_several_payer_on_hold",
    );
    expect(evaluate).toHaveBeenCalled();
    expect(ensureForLot).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it("checks each lot's winner as well as the payer: a held winner stops the payment", async () => {
    // Maya (owner-1) won the lot; the finance member pays for it.
    const { svc, start, evaluate } = service({ holdFor: "owner-1" });
    expect((await payShown(svc, actor("finance"), [LOTS.due]))._unsafeUnwrapErr().code).toBe(
      "pay_several_winner_on_hold",
    );
    expect(evaluate).toHaveBeenCalledWith(expect.objectContaining({ buyerUserId: "finance-1" }));
    expect(evaluate).toHaveBeenCalledWith(expect.objectContaining({ buyerUserId: "owner-1" }));
    expect(start).not.toHaveBeenCalled();
  });

  it.each([
    [{ kind: "refused", reason: "organisation_closed" }],
    [{ kind: "held", reason: "organisation_under_review" }],
    [{ kind: "held", reason: "identity_verification_required" }],
  ] as const)(
    "an account %o can neither plan nor pay, as with one invoice",
    async (eligibility) => {
      const { svc, start, ensureForLot } = service({ eligibility, withNotInvoiced: true });
      expect((await svc.plan(actor("owner"), [LOTS.due]))._unsafeUnwrapErr().code).toBe(
        eligibility.reason,
      );
      const paid = (await payShown(svc, actor("owner"), [NOT_INVOICED]))._unsafeUnwrapErr();
      expect(paid.code).toBe(eligibility.reason);
      expect(paid.status).toBe(eligibility.kind === "refused" ? 403 : 409);
      expect(ensureForLot).not.toHaveBeenCalled();
      expect(start).not.toHaveBeenCalled();
    },
  );

  it("answers a race for the same invoices with a conflict, and an outage with unavailable", async () => {
    const conflict = service({ start: vi.fn(async () => err("conflict")) });
    expect(
      (await payShown(conflict.svc, actor("owner"), [LOTS.due]))._unsafeUnwrapErr(),
    ).toMatchObject({
      code: "pay_several_conflict",
      status: 409,
    });
    const down = service({ start: vi.fn(async () => err("unavailable")) });
    expect((await payShown(down.svc, actor("owner"), [LOTS.due]))._unsafeUnwrapErr()).toMatchObject(
      {
        code: "pay_several_unavailable",
        status: 503,
      },
    );
  });
});

describe("PaySeveralService.pay with a lot that is not invoiced yet", () => {
  it("raises the invoice first and charges exactly what the plan showed", async () => {
    const world = service({ withNotInvoiced: true });
    const lots = [LOTS.due, NOT_INVOICED];
    const shown = (await world.svc.plan(actor("owner"), lots))._unsafeUnwrap();
    expect(shown.total).toBe("3100.10");

    const started = (await payShown(world.svc, actor("owner"), lots))._unsafeUnwrap();

    const [call] = world.start.mock.calls;
    expect(call?.[0]).toMatchObject({
      total: "3100.10",
      invoices: [
        { paymentId: "pay-2", lotId: LOTS.due, amount: "600.10" },
        { paymentId: "pay-new", lotId: NOT_INVOICED, amount: "2500.00" },
      ],
    });
    expect(started.total).toBe(shown.total);
    expect(started.payable).toEqual(
      shown.payable.map((p) => ({ lotId: p.lotId, amount: p.totalDue })),
    );
    // The invoice exists before the payment claims it.
    expect(world.ensureForLot.mock.invocationCallOrder[0]).toBeLessThan(
      world.start.mock.invocationCallOrder[0] ?? 0,
    );
    expect(world.ensureForLot).toHaveBeenCalledTimes(1);
    expect(world.ensureForLot).toHaveBeenCalledWith(NOT_INVOICED, { accounting: "defer" });
  });

  it("never charges a lot whose invoice is raised held for review: the plan changed, so it asks again", async () => {
    const world = service({ withNotInvoiced: true, raiseStatus: "requires_manual_review" });
    const lots = [LOTS.due, NOT_INVOICED];
    const refused = (await payShown(world.svc, actor("owner"), lots))._unsafeUnwrapErr();
    expect(refused).toMatchObject({ code: "pay_plan_changed", status: 409 });
    expect(refused.quote?.total).toBe("600.10");
    expect(refused.quote?.skipped).toEqual([{ lotId: NOT_INVOICED, reason: "held_for_review" }]);
    expect(world.start).not.toHaveBeenCalled();

    // Paying the plan it was shown now charges only the lot that can be paid.
    const started = (await payShown(world.svc, actor("owner"), lots))._unsafeUnwrap();
    expect(world.start.mock.calls[0]?.[0]).toMatchObject({
      total: "600.10",
      invoices: [{ paymentId: "pay-2", lotId: LOTS.due, amount: "600.10" }],
    });
    expect(started.skipped).toEqual([{ lotId: NOT_INVOICED, reason: "held_for_review" }]);
  });

  it("says nothing is payable, and claims nothing, when the only lot is held once raised", async () => {
    const world = service({ withNotInvoiced: true, raiseStatus: "requires_manual_review" });
    expect(
      (await payShown(world.svc, actor("owner"), [NOT_INVOICED]))._unsafeUnwrapErr().code,
    ).toBe("pay_several_nothing_payable");
    expect(world.start).not.toHaveBeenCalled();
  });

  it("claims nothing when raising an invoice fails", async () => {
    const world = service({ withNotInvoiced: true, raiseFails: true });
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(
      (await payShown(world.svc, actor("owner"), [LOTS.due, NOT_INVOICED]))._unsafeUnwrapErr(),
    ).toMatchObject({
      code: "pay_several_unavailable",
      status: 503,
    });
    expect(world.start).not.toHaveBeenCalled();
    expect(world.evaluate).not.toHaveBeenCalled();
    logged.mockRestore();
  });

  it("leaves out a lot the lot-end guards will not invoice, with the plan asked again", async () => {
    const world = service({ withNotInvoiced: true, raiseCreatesNothing: true });
    const refused = (
      await payShown(world.svc, actor("owner"), [LOTS.due, NOT_INVOICED])
    )._unsafeUnwrapErr();
    expect(refused).toMatchObject({ code: "pay_plan_changed", status: 409 });
    expect(refused.quote?.skipped).toEqual([{ lotId: NOT_INVOICED, reason: "not_invoiced" }]);
    expect(refused.quote?.total).toBe("600.10");
    expect(world.start).not.toHaveBeenCalled();
  });

  it("two attempts at once and the lot-end raise share one invoice and one claim", async () => {
    const claimed = new Set<string>();
    const start = vi.fn(async (input: { invoices: { paymentId: string }[]; rail: string }) => {
      // The group claim takes every invoice or none: a second claim of the same payment loses.
      await Promise.resolve();
      if (input.invoices.some((i) => claimed.has(i.paymentId))) return err("conflict" as const);
      for (const i of input.invoices) claimed.add(i.paymentId);
      return ok({
        paymentGroupId: "group-1",
        checkoutUrl: "https://pay.example/g1",
        rail: input.rail,
      });
    });
    const world = service({ withNotInvoiced: true, start });
    const lots = [LOTS.due, NOT_INVOICED];
    const results = await Promise.all([
      payShown(world.svc, actor("owner"), lots),
      payShown(world.svc, actor("finance"), lots),
      // Lot end raises the same invoice at the same moment.
      world.ensureForLot(NOT_INVOICED),
    ]);
    const [a, b] = results;
    const outcomes = [a, b].map((r) => (r && "isOk" in r && r.isOk() ? "started" : "refused"));
    expect(outcomes.sort()).toEqual(["refused", "started"]);
    const refused = [a, b].find((r) => r && "isErr" in r && r.isErr());
    expect(refused && "isErr" in refused ? refused.error.code : null).toMatch(
      /pay_several_conflict|pay_plan_changed|pay_several_nothing_payable/,
    );
    // One invoice for the lot, however many callers asked for it.
    expect(claimed.has("pay-new")).toBe(true);
    expect([...claimed].filter((id) => id === "pay-new")).toHaveLength(1);
  });
});

describe("PaySeveralService pays only the plan that was shown", () => {
  const lots = [LOTS.due, NOT_INVOICED];

  it("answers 409 with the fresh plan when the total changed since it was shown, and raises and claims nothing", async () => {
    const world = service({ withNotInvoiced: true });
    const shown = (await world.svc.plan(actor("owner"), lots))._unsafeUnwrap();
    // The lot is repriced after the person saw the total.
    world.price.mockResolvedValue({
      lines: [
        { kind: "hammer", label: "Hammer price", ratePercent: null, amountPence: 100_000 },
        {
          kind: "buyers_premium",
          label: "Buyer's premium (25%)",
          ratePercent: "25",
          amountPence: 25_000,
        },
      ],
      totalPence: 125_000,
      policyId: "flat:0.25",
      existing: null,
    });
    const refused = (
      await world.svc.pay(actor("owner"), {
        lotIds: lots,
        expectedTotalPence: Math.round(Number(shown.total) * 100),
        expectedLotIds: shown.payable.map((p) => p.lotId),
      })
    )._unsafeUnwrapErr();
    expect(refused).toMatchObject({ code: "pay_plan_changed", status: 409 });
    expect(refused.quote?.total).toBe("1850.10");
    expect(world.ensureForLot).not.toHaveBeenCalled();
    expect(world.evaluate).not.toHaveBeenCalled();
    expect(world.start).not.toHaveBeenCalled();
  });

  it("answers 409 when a repricing crosses the card limit, instead of switching to bank transfer", async () => {
    const world = service({ withNotInvoiced: true });
    const shown = (await world.svc.plan(actor("owner"), lots))._unsafeUnwrap();
    expect(shown.payTogether).toEqual({ allowed: true, rail: "card" });
    world.price.mockResolvedValue({
      lines: [
        { kind: "hammer", label: "Hammer price", ratePercent: null, amountPence: 360_000 },
        {
          kind: "buyers_premium",
          label: "Buyer's premium (25%)",
          ratePercent: "25",
          amountPence: 90_000,
        },
      ],
      totalPence: 450_000,
      policyId: "flat:0.25",
      existing: null,
    });
    const refused = (
      await world.svc.pay(actor("owner"), {
        lotIds: lots,
        expectedTotalPence: 310_010,
        expectedLotIds: lots,
      })
    )._unsafeUnwrapErr();
    expect(refused.code).toBe("pay_plan_changed");
    expect(refused.quote?.payTogether).toEqual({ allowed: true, rail: "gb_bank_transfer" });
    expect(world.start).not.toHaveBeenCalled();
  });

  it("answers 409 when the invoice is raised at a total that crosses the card limit", async () => {
    const world = service({ withNotInvoiced: true, raiseAmount: "4600.00" });
    const refused = (await payShown(world.svc, actor("owner"), lots))._unsafeUnwrapErr();
    expect(refused).toMatchObject({ code: "pay_plan_changed", status: 409 });
    expect(refused.quote?.total).toBe("5200.10");
    expect(refused.quote?.payTogether).toEqual({ allowed: true, rail: "gb_bank_transfer" });
    expect(world.start).not.toHaveBeenCalled();
  });

  it("answers 409 when another payment takes some of the lots while this one is raising", async () => {
    const world = service({
      withNotInvoiced: true,
      flagsAfterRaise: { "pay-2": { heldForReview: false, inPaymentInProgress: true } },
    });
    const refused = (await payShown(world.svc, actor("owner"), lots))._unsafeUnwrapErr();
    expect(refused).toMatchObject({ code: "pay_plan_changed", status: 409 });
    expect(refused.quote?.skipped).toEqual([{ lotId: LOTS.due, reason: "being_paid" }]);
    expect(refused.quote?.payable.map((p) => p.lotId)).toEqual([NOT_INVOICED]);
    expect(world.start).not.toHaveBeenCalled();
  });

  it("answers 409 when the shown lots differ even if the total happens to match", async () => {
    const world = service();
    const refused = (
      await world.svc.pay(actor("owner"), {
        lotIds: [LOTS.due, LOTS.overdue],
        expectedTotalPence: 100_010,
        expectedLotIds: [LOTS.due, LOTS.agentWin],
      })
    )._unsafeUnwrapErr();
    expect(refused.code).toBe("pay_plan_changed");
  });

  it("refuses a total that cannot be paid at once before raising anything", async () => {
    const world = service({
      withNotInvoiced: true,
      limits: { ...LIMITS, manualReviewMinPence: 100_000 },
    });
    const refused = (await payShown(world.svc, actor("owner"), lots))._unsafeUnwrapErr();
    expect(refused.code).toBe("pay_several_needs_finance_review");
    expect(world.ensureForLot).not.toHaveBeenCalled();
    expect(world.start).not.toHaveBeenCalled();
  });

  it("is told the current plan, and charges nothing, when the request names no plan", async () => {
    const world = service({ withNotInvoiced: true });
    const refused = (await world.svc.pay(actor("owner"), { lotIds: lots }))._unsafeUnwrapErr();
    expect(refused).toMatchObject({ code: "pay_plan_changed", status: 409 });
    expect(refused.quote?.total).toBe("3100.10");
    expect(world.ensureForLot).not.toHaveBeenCalled();
    expect(world.start).not.toHaveBeenCalled();
  });

  it("counts each lot the lot-end guards will not invoice, by reason", async () => {
    const record = vi.fn();
    const world = service({
      withNotInvoiced: true,
      raiseCreatesNothing: true,
      metrics: { record },
    });
    await payShown(world.svc, actor("owner"), lots);
    expect(record).toHaveBeenCalledWith("pay_several_lot_not_invoiced_lot_not_ended");
  });

  it("leaves the accounting write to the group checkout when it raises", async () => {
    const world = service({ withNotInvoiced: true });
    (await payShown(world.svc, actor("owner"), lots))._unsafeUnwrap();
    expect(world.ensureForLot).toHaveBeenCalledWith(NOT_INVOICED, { accounting: "defer" });
  });
});

describe("PaySeveralService source of funds, counted once", () => {
  // The winner (owner-1) has two open invoices, pay-2 (£600.10) and pay-3 (£400.00), and a
  // finance member pays both. Threshold £1,500: £1,000.10 is under it.
  const OPEN = [
    { id: "pay-2", buyerId: "owner-1", pence: 60_010 },
    { id: "pay-3", buyerId: "owner-1", pence: 40_000 },
  ];
  function realCompliance() {
    const sumActiveBuyerSettlementPence = vi.fn(
      async (userId: string, exclude?: string | readonly string[]) => {
        const excluded = new Set(typeof exclude === "string" ? [exclude] : (exclude ?? []));
        return OPEN.filter((p) => p.buyerId === userId && !excluded.has(p.id)).reduce(
          (sum, p) => sum + p.pence,
          0,
        );
      },
    );
    const repo = {
      sumActiveBuyerSettlementPence,
      findLatestApprovedForUser: vi.fn(async () => null),
      findPendingForUser: vi.fn(async () => null),
      findLatestForUser: vi.fn(async () => null),
      create: vi.fn(async (input: { userId: string }) => ({
        case: { id: "sof-1", ...input },
        created: true,
      })),
    };
    const policy = new AmlSettlementCompliancePolicy(
      { getHold: vi.fn(async () => null) } as never,
      new SourceOfFundsGateService(repo as never, {
        thresholdAmount: 1500,
        currency: "GBP",
        approvalValidityDays: 365,
      }),
    );
    return { policy, repo };
  }

  it("leaves the invoices being paid out of each person's exposure, so they count once", async () => {
    const { policy, repo } = realCompliance();
    const { planner, ensureForLot } = service();
    const start = vi.fn(async (input: { rail: string }) =>
      ok({ paymentGroupId: "group-1", checkoutUrl: "https://pay.example/g1", rail: input.rail }),
    );
    const svc = new PaySeveralService({
      planner,
      invoices: { ensureForLot },
      limits: LIMITS,
      compliance: { evaluate: (i) => policy.evaluate(i) },
      checkout: { start } as never,
    });
    const result = await payShown(svc, actor("finance"), [LOTS.due, LOTS.overdue]);
    expect(result.isOk()).toBe(true);
    expect(repo.create).not.toHaveBeenCalled();
    for (const [, exclude] of repo.sumActiveBuyerSettlementPence.mock.calls) {
      expect(exclude).toEqual(["pay-2", "pay-3"]);
    }
  });
});
