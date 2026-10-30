import type { PaymentTierLimits } from "@auction/domain";
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
    evaluate: vi.fn(async () => ({ hold: over.evaluateHold ?? false, reason: null })),
  };
  const svc = new PaySeveralService({
    reader: new InMemoryPurchaseFacts(),
    flags: {
      flagsFor: async (ids) =>
        new Map(ids.flatMap((id) => (over.flags?.[id] ? [[id, over.flags[id]]] : []))),
    },
    limits: over.limits ?? LIMITS,
    compliance,
    checkout: { start },
    now: () => NOW,
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
