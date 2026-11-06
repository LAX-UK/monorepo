import type { PaymentEligibility, PaymentTierLimits } from "@auction/domain";
import { AmlSettlementCompliancePolicy, SourceOfFundsGateService } from "@auction/finance-runtime";
import type { PaySeveralInvoiceFlags } from "@auction/persistence/interfaces";
import type { LegalEntityMemberRole } from "@auction/types";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import {
  BUYING_ACCOUNT,
  InMemoryPurchaseFacts,
  LOTS,
  NOW,
} from "../../testing/in-memory-workspace-buying.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import { PaySeveralService } from "./pay-several.service.js";
import { PurchaseCandidateReader } from "./purchase-candidate.reader.js";

const LIMITS: PaymentTierLimits = {
  minPence: 30,
  cardMaxPence: 500_000,
  manualReviewMinPence: 2_500_000,
  absoluteMaxPence: 10_000_000,
};

const actor = (
  role: LegalEntityMemberRole,
  over: Partial<OrganisationMemberActor> = {},
): OrganisationMemberActor => ({
  userId: `${role}-1`,
  legalEntityId: BUYING_ACCOUNT,
  role,
  ...over,
});

function service(
  over: {
    flags?: Record<string, PaySeveralInvoiceFlags>;
    limits?: PaymentTierLimits;
    peekHold?: boolean;
    evaluateHold?: boolean;
    /** Only this person is on hold (the payer or a lot's winner). */
    holdFor?: string;
    eligibility?: PaymentEligibility;
    start?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const start =
    over.start ??
    vi.fn(async (input: { rail: string }) =>
      ok({ paymentGroupId: "group-1", checkoutUrl: "https://pay.example/g1", rail: input.rail }),
    );
  const compliance = {
    peek: vi.fn(async () => ({ hold: over.peekHold ?? false, reason: null })),
    evaluate: vi.fn(async (input: { buyerUserId: string }) => ({
      hold: over.evaluateHold ?? input.buyerUserId === over.holdFor,
      reason: null,
    })),
  };
  const svc = new PaySeveralService({
    candidates: new PurchaseCandidateReader({
      reader: new InMemoryPurchaseFacts(),
      flags: {
        flagsFor: async (ids) =>
          new Map(ids.flatMap((id) => (over.flags?.[id] ? [[id, over.flags[id]]] : []))),
      },
      now: () => NOW,
    }),
    limits: over.limits ?? LIMITS,
    compliance,
    eligibility: { check: vi.fn(async () => over.eligibility ?? { kind: "payable" as const }) },
    checkout: { start },
  });
  return { svc, start, compliance };
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
    expect(plan.payable.map((p) => [p.lotId, p.paymentId])).toEqual([
      [LOTS.due, "pay-2"],
      [LOTS.overdue, "pay-3"],
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
    const result = await svc.plan(actor("owner"), [LOTS.due, LOTS.overdue, LOTS.agentWin]);
    const plan = result._unsafeUnwrap();
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

  it("says when the payer has a compliance check open, without opening one", async () => {
    const { svc, compliance } = service({ peekHold: true });
    const plan = (await svc.plan(actor("owner"), [LOTS.due]))._unsafeUnwrap();
    expect(plan.payTogether).toEqual({ allowed: false, reason: "payer_on_hold" });
    expect(compliance.evaluate).not.toHaveBeenCalled();
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
    const { svc, start, compliance } = service();
    const started = (
      await svc.pay(actor("finance"), [LOTS.due, LOTS.overdue, LOTS.paid])
    )._unsafeUnwrap();
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
    expect(compliance.evaluate).toHaveBeenCalledWith({
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

  it("refuses roles that do not pay, before anything is held", async () => {
    for (const role of ["buyer_agent", "viewer", "consignor"] as const) {
      const { svc, start } = service();
      expect((await svc.pay(actor(role), [LOTS.due]))._unsafeUnwrapErr()).toMatchObject({
        code: "insufficient_entity_role",
        status: 403,
      });
      expect(start).not.toHaveBeenCalled();
    }
  });

  it("refuses a total that cannot be paid at once, saying why, and holds nothing", async () => {
    const { svc, start } = service({ limits: { ...LIMITS, manualReviewMinPence: 100_000 } });
    expect(
      (await svc.pay(actor("owner"), [LOTS.due, LOTS.overdue]))._unsafeUnwrapErr(),
    ).toMatchObject({ code: "pay_several_needs_finance_review", status: 409 });
    expect(start).not.toHaveBeenCalled();
  });

  it("refuses when the compliance check on the total holds the payer", async () => {
    const { svc, start } = service({ evaluateHold: true });
    expect((await svc.pay(actor("owner"), [LOTS.due]))._unsafeUnwrapErr().code).toBe(
      "pay_several_payer_on_hold",
    );
    expect(start).not.toHaveBeenCalled();
  });

  it("checks each lot's winner as well as the payer: a held winner stops the payment", async () => {
    // Maya (owner-1) won the lot; the finance member pays for it.
    const { svc, start, compliance } = service({ holdFor: "owner-1" });
    expect((await svc.pay(actor("finance"), [LOTS.due]))._unsafeUnwrapErr().code).toBe(
      "pay_several_winner_on_hold",
    );
    expect(compliance.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ buyerUserId: "finance-1" }),
    );
    expect(compliance.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ buyerUserId: "owner-1" }),
    );
    expect(start).not.toHaveBeenCalled();
  });

  it.each([
    [{ kind: "refused", reason: "organisation_closed" }],
    [{ kind: "held", reason: "organisation_under_review" }],
    [{ kind: "held", reason: "identity_verification_required" }],
  ] as const)(
    "an account %o can neither plan nor pay, as with one invoice",
    async (eligibility) => {
      const { svc, start } = service({ eligibility });
      expect((await svc.plan(actor("owner"), [LOTS.due]))._unsafeUnwrapErr().code).toBe(
        eligibility.reason,
      );
      const paid = (await svc.pay(actor("owner"), [LOTS.due]))._unsafeUnwrapErr();
      expect(paid.code).toBe(eligibility.reason);
      expect(paid.status).toBe(eligibility.kind === "refused" ? 403 : 409);
      expect(start).not.toHaveBeenCalled();
    },
  );

  it("answers a race for the same invoices with a conflict, and an outage with unavailable", async () => {
    const conflict = service({ start: vi.fn(async () => err("conflict")) });
    expect((await conflict.svc.pay(actor("owner"), [LOTS.due]))._unsafeUnwrapErr()).toMatchObject({
      code: "pay_several_conflict",
      status: 409,
    });
    const down = service({ start: vi.fn(async () => err("unavailable")) });
    expect((await down.svc.pay(actor("owner"), [LOTS.due]))._unsafeUnwrapErr()).toMatchObject({
      code: "pay_several_unavailable",
      status: 503,
    });
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
      create: vi.fn(async (input: { userId: string }) => ({ id: "sof-1", ...input })),
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
    const start = vi.fn(async (input: { rail: string }) =>
      ok({ paymentGroupId: "group-1", checkoutUrl: "https://pay.example/g1", rail: input.rail }),
    );
    const svc = new PaySeveralService({
      candidates: new PurchaseCandidateReader({
        reader: new InMemoryPurchaseFacts(),
        flags: { flagsFor: async () => new Map() },
        now: () => NOW,
      }),
      limits: LIMITS,
      compliance: {
        peek: vi.fn(async () => ({ hold: false, reason: null })),
        evaluate: (i) => policy.evaluate(i),
      },
      eligibility: { check: vi.fn(async () => ({ kind: "payable" as const })) },
      checkout: { start } as never,
    });
    const result = await svc.pay(actor("finance"), [LOTS.due, LOTS.overdue]);
    expect(result.isOk()).toBe(true);
    expect(repo.create).not.toHaveBeenCalled();
    for (const [, exclude] of repo.sumActiveBuyerSettlementPence.mock.calls) {
      expect(exclude).toEqual(["pay-2", "pay-3"]);
    }
  });
});
