import type { InvoiceLine } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  PAY_PLAN_MAX_LOTS,
  type PayPlanFacts,
  type PayPlanLot,
  buildPayPlan,
  classifyPayPlanLots,
  pickRefusal,
} from "./pay-plan.js";
import { parsePaymentTierLimits, paymentMethodsFor } from "./payment-tier-policy.js";

const ACCOUNT = "acct-1";
const limits = parsePaymentTierLimits({
  STRIPE_CARD_CHECKOUT_MAX: 10_000,
  STRIPE_MANUAL_REVIEW_MIN: 500_000,
  STRIPE_ABSOLUTE_MAX: 999_999.99,
});

const lines = (hammer: number, premium = 0): InvoiceLine[] => [
  { kind: "hammer", label: "Hammer price", ratePercent: null, amountPence: hammer },
  ...(premium > 0
    ? [
        {
          kind: "buyers_premium" as const,
          label: "Buyer's premium (25%)",
          ratePercent: "25",
          amountPence: premium,
        },
      ]
    : []),
];

function lot(id: string, overrides: Partial<PayPlanLot> = {}): PayPlanLot {
  return {
    lotId: id,
    buyerAccountId: ACCOUNT,
    title: `Lot ${id}`,
    lotNumber: 1,
    saleTitle: "Autumn sale",
    invoice: "due",
    paymentStatus: "pending",
    paymentId: `pay-${id}`,
    invoiceId: `inv-${id}`,
    invoiceVoided: false,
    payerMayPay: true,
    heldForReview: false,
    inPaymentInProgress: false,
    lines: lines(100_000, 25_000),
    dueAt: new Date("2026-11-12T23:59:59.999Z"),
    ...overrides,
  };
}

function facts(
  overrides: Partial<PayPlanFacts> = {},
  lots: PayPlanLot[] = [lot("a")],
): PayPlanFacts {
  return {
    account: { legalEntityId: ACCOUNT, kind: "individual", name: "Amira Hassan" },
    payerRole: "payer",
    entity: {
      name: "London Auction Xchange LTD",
      address: "156 New Cavendish Street",
      companyNumber: null,
      vatNumber: null,
    },
    onboardingComplete: true,
    eligibility: { kind: "payable" },
    compliance: { hold: false },
    limits,
    classified: classifyPayPlanLots(ACCOUNT, lots),
    deliveryInPayment: false,
    delivery: [],
    progress: null,
    ...overrides,
  };
}

describe("pickRefusal", () => {
  it("refuses none, more than 20 and the same lot twice", () => {
    expect(pickRefusal([])).toBe("pay_several_empty");
    expect(pickRefusal(Array.from({ length: PAY_PLAN_MAX_LOTS + 1 }, (_, i) => `l${i}`))).toBe(
      "pay_several_too_many",
    );
    expect(pickRefusal(["a", "b", "a"])).toBe("pay_several_duplicate");
  });

  it("accepts one lot and twenty lots", () => {
    expect(pickRefusal(["a"])).toBeNull();
    expect(pickRefusal(Array.from({ length: PAY_PLAN_MAX_LOTS }, (_, i) => `l${i}`))).toBeNull();
  });
});

describe("classifyPayPlanLots: what is left out, and why", () => {
  const reasonFor = (overrides: Partial<PayPlanLot>) =>
    classifyPayPlanLots(ACCOUNT, [lot("a", overrides)]).leftOut[0]?.reason;

  it.each([
    ["another account's lot", { buyerAccountId: "someone-else" }, "other_account"],
    ["a paid invoice", { invoice: "paid", paymentStatus: "captured" }, "paid"],
    [
      "a payment being confirmed",
      { invoice: "processing", paymentStatus: "authorized" },
      "being_confirmed",
    ],
    [
      "a payment waiting for a review",
      { invoice: "processing", paymentStatus: "requires_manual_review" },
      "held_for_review",
    ],
    ["a refunded invoice", { invoice: "refunded", paymentStatus: "refunded" }, "refunded"],
    ["a cancelled purchase", { invoice: "cancelled" }, "cancelled"],
    ["a voided invoice", { invoiceVoided: true, invoice: "cancelled" }, "voided"],
    ["a lot the person does not pay for", { payerMayPay: false }, "not_payer"],
    ["a seller-side review", { heldForReview: true }, "held_for_review"],
    ["a payment already in another payment", { inPaymentInProgress: true }, "being_paid"],
  ] as const)("%s", (_name, overrides, reason) => {
    expect(reasonFor(overrides as Partial<PayPlanLot>)).toBe(reason);
  });

  it("a voided invoice is reported as voided, not as cancelled", () => {
    expect(reasonFor({ invoiceVoided: true, invoice: "cancelled" })).toBe("voided");
  });

  it("someone who does not pay for the account still sees its lots, totals and due date", () => {
    const informed = classifyPayPlanLots(ACCOUNT, [lot("a", { payerMayPay: false })], "informed");
    expect(informed.payable.map((p) => p.lotId)).toEqual(["a"]);
    expect(informed.leftOut).toEqual([]);
    const built = buildPayPlan(facts({ payerRole: "informed", classified: informed }));
    expect(built.totals.pence).toBe(125_000);
    expect(built.firstDueAt).toBe("2026-11-12T23:59:59.999Z");
    expect(built.gate.kind).toBe("not_payer");
  });

  it("a payer is told about a lot they may not pay, and other lots are left out as usual", () => {
    const result = classifyPayPlanLots(
      ACCOUNT,
      [lot("a", { payerMayPay: false }), lot("b", { invoice: "paid" })],
      "payer",
    );
    expect(result.leftOut).toEqual([
      { lotId: "a", reason: "not_payer" },
      { lotId: "b", reason: "paid" },
    ]);
  });

  it("another account's lot is reported first, whatever else is true of it", () => {
    expect(reasonFor({ buyerAccountId: "x", invoice: "paid", payerMayPay: false })).toBe(
      "other_account",
    );
  });

  it("keeps the others and the picked order when one is left out", () => {
    const result = classifyPayPlanLots(ACCOUNT, [
      lot("a"),
      lot("b", { invoice: "paid" }),
      lot("c", { invoice: "overdue" }),
    ]);
    expect(result.payable.map((p) => p.lotId)).toEqual(["a", "c"]);
    expect(result.leftOut).toEqual([{ lotId: "b", reason: "paid" }]);
    expect(result.payable[1]?.overdue).toBe(true);
  });

  it("an overdue invoice is still payable and says it is overdue", () => {
    const [p] = classifyPayPlanLots(ACCOUNT, [lot("a", { invoice: "overdue" })]).payable;
    expect(p?.overdue).toBe(true);
  });

  it("a lot won but not invoiced yet is payable, without a payment id", () => {
    const [p] = classifyPayPlanLots(ACCOUNT, [
      lot("a", { invoice: "not_invoiced", paymentId: null, invoiceId: null, paymentStatus: null }),
    ]).payable;
    expect(p).toMatchObject({ lotId: "a", paymentId: null, invoiceId: null, totalPence: 125_000 });
  });
});

describe("buildPayPlan: totals", () => {
  it("adds the stored lines, in pence, by kind and in total", () => {
    const plan = buildPayPlan(
      facts({}, [
        lot("a", { lines: lines(100_000, 25_000) }),
        lot("b", { lines: lines(33_333, 8_333) }),
      ]),
    );
    expect(plan.totals).toEqual({
      pence: 166_666,
      deliveryPence: 0,
      byKind: [
        { kind: "hammer", pence: 133_333 },
        { kind: "buyers_premium", pence: 33_333 },
      ],
    });
    expect(plan.payable.map((p) => p.totalPence)).toEqual([125_000, 41_666]);
    expect(plan.currency).toBe("GBP");
  });

  it("the first due date is the earliest of the payable invoices", () => {
    const plan = buildPayPlan(
      facts({}, [
        lot("a", { dueAt: new Date("2026-11-20T23:59:59.999Z") }),
        lot("b", { dueAt: new Date("2026-11-08T23:59:59.999Z") }),
        lot("c", { invoice: "paid", dueAt: new Date("2026-11-01T23:59:59.999Z") }),
      ]),
    );
    expect(plan.firstDueAt).toBe("2026-11-08T23:59:59.999Z");
  });

  it("has no first due date when nothing is payable", () => {
    const plan = buildPayPlan(facts({}, [lot("a", { invoice: "paid" })]));
    expect(plan.firstDueAt).toBeNull();
    expect(plan.totals).toEqual({ pence: 0, deliveryPence: 0, byKind: [] });
  });
});

describe("buildPayPlan: delivery", () => {
  const courier = (lotId: string, amountPence: number) => ({
    lotId,
    quoteId: `quote-${lotId}`,
    amountPence,
    destination: "12 Vyner Street, London E2 9DG",
    note: null,
  });

  it("adds an accepted quote to the total, apart from the invoices' lines", () => {
    const plan = buildPayPlan(
      facts({ deliveryInPayment: true, delivery: [courier("a", 18_000)] }, [
        lot("a", { lines: lines(100_000, 25_000) }),
      ]),
    );
    expect(plan.delivery).toEqual([courier("a", 18_000)]);
    expect(plan.totals).toEqual({
      pence: 143_000,
      deliveryPence: 18_000,
      byKind: [
        { kind: "hammer", pence: 100_000 },
        { kind: "buyers_premium", pence: 25_000 },
      ],
    });
    expect(plan.payable[0]?.totalPence).toBe(125_000);
  });

  it("drops a quote for a lot the payment does not cover", () => {
    const plan = buildPayPlan(
      facts({ delivery: [courier("a", 18_000), courier("gone", 9_900)] }, [
        lot("a"),
        lot("gone", { invoice: "paid" }),
      ]),
    );
    expect(plan.delivery.map((d) => d.lotId)).toEqual(["a"]);
    expect(plan.totals.deliveryPence).toBe(18_000);
  });

  it("counts delivery toward the card and finance limits", () => {
    const near = limits.cardMaxPence - 1_000;
    const plan = buildPayPlan(
      facts({ delivery: [courier("a", 5_000)] }, [lot("a", { lines: lines(near, 0) })]),
    );
    expect(plan.methods.find((m) => m.method === "card")?.available).toBe(false);
  });
});

describe("buildPayPlan: the gate, first that applies", () => {
  it("is clear when nothing stops the payment", () => {
    expect(buildPayPlan(facts()).gate).toEqual({ kind: "clear" });
  });

  it("someone who does not pay for the account is told who does, before anything else", () => {
    const plan = buildPayPlan(
      facts({
        payerRole: "informed",
        onboardingComplete: false,
        eligibility: { kind: "refused", reason: "organisation_closed" },
      }),
    );
    expect(plan.gate).toEqual({ kind: "not_payer", payingAccountName: "Amira Hassan" });
  });

  it("onboarding comes before the account rule", () => {
    const plan = buildPayPlan(
      facts({
        onboardingComplete: false,
        eligibility: { kind: "held", reason: "identity_verification_required" },
      }),
    );
    expect(plan.gate).toEqual({ kind: "onboarding_required" });
  });

  it("a closed organisation is refused, and the account rule comes before the checks on the amount", () => {
    const plan = buildPayPlan(
      facts({
        eligibility: { kind: "refused", reason: "organisation_closed" },
        compliance: { hold: true, reason: "aml_hold", subject: "payer" },
      }),
    );
    expect(plan.gate).toEqual({ kind: "refused", reason: "organisation_closed" });
  });

  it.each(["identity_verification_required", "organisation_under_review"] as const)(
    "an account that cannot pay yet is held: %s",
    (reason) => {
      expect(buildPayPlan(facts({ eligibility: { kind: "held", reason } })).gate).toEqual({
        kind: "held",
        reason,
      });
    },
  );

  it("a check on the amount comes before the finance check", () => {
    const plan = buildPayPlan(
      facts({ compliance: { hold: true, reason: "source_of_funds_required", subject: "winner" } }, [
        lot("a", { lines: lines(60_000_000) }),
      ]),
    );
    expect(plan.gate).toEqual({
      kind: "compliance",
      reason: "source_of_funds_required",
      subject: "winner",
    });
  });

  it("a total of exactly the finance limit needs the finance check; one penny less does not", () => {
    expect(buildPayPlan(facts({}, [lot("a", { lines: lines(50_000_000) })])).gate).toEqual({
      kind: "finance_check",
    });
    expect(buildPayPlan(facts({}, [lot("a", { lines: lines(49_999_999) })])).gate).toEqual({
      kind: "clear",
    });
  });

  it("the finance limit applies to the total of several invoices, not to each one", () => {
    const plan = buildPayPlan(
      facts({}, [lot("a", { lines: lines(30_000_000) }), lot("b", { lines: lines(20_000_000) })]),
    );
    expect(plan.gate).toEqual({ kind: "finance_check" });
  });

  it("a gate that stops the payment still lists the lots and their lines", () => {
    const plan = buildPayPlan(
      facts({ eligibility: { kind: "held", reason: "organisation_under_review" } }),
    );
    expect(plan.gate.kind).toBe("held");
    expect(plan.payable).toHaveLength(1);
    expect(plan.payable[0]?.lines).toHaveLength(2);
  });
});

describe("payment methods", () => {
  it("card takes exactly the card limit", () => {
    const [card, transfer] = paymentMethodsFor(1_000_000, limits);
    expect(card).toEqual({ method: "card", available: true, reason: null });
    expect(transfer?.available).toBe(true);
  });

  it("one penny over the card limit is bank transfer only", () => {
    const [card, transfer] = paymentMethodsFor(1_000_001, limits);
    expect(card).toEqual({ method: "card", available: false, reason: "over_card_limit" });
    expect(transfer).toEqual({ method: "bank_transfer", available: true, reason: null });
  });

  it("nothing online takes more than the online limit", () => {
    const [card, transfer] = paymentMethodsFor(100_000_000, limits);
    expect(card?.available).toBe(false);
    expect(transfer).toMatchObject({ available: false, reason: "over_online_limit" });
  });

  it("the plan carries the card limit from the server's limits", () => {
    expect(buildPayPlan(facts()).cardLimitPence).toBe(limits.cardMaxPence);
  });

  it("the plan carries a payment already under way", () => {
    const progress = {
      rail: "bank_transfer" as const,
      stage: "part_received" as const,
      lots: [{ lotId: "a", title: "A", lotNumber: 1, saleTitle: null, totalPence: 100 }],
      totalPence: 100,
      receivedPence: 40,
      remainingPence: 60,
      receivedPercent: 40,
      otherInvoices: 0,
    };
    expect(buildPayPlan(facts({ progress })).progress).toEqual(progress);
    expect(buildPayPlan(facts()).progress).toBeNull();
  });

  it("the plan carries the methods for its total", () => {
    const plan = buildPayPlan(
      facts({}, [lot("a", { lines: lines(1_000_000) }), lot("b", { lines: lines(1) })]),
    );
    expect(plan.methods[0]).toMatchObject({ method: "card", available: false });
    expect(plan.methods[1]).toMatchObject({ method: "bank_transfer", available: true });
  });
});
