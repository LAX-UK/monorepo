import { type DealClearanceSnapshot, resolvePrivateSalePolicy } from "@auction/domain";
import type { PrivateSaleStageChange } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { makeDeal, recordingSink } from "./deal-fixtures.test-util.js";
import { DealTransitionService } from "./deal-transition.service.js";

const CLEAR: DealClearanceSnapshot = {
  seller: { kyc: "clear", aml: "clear" },
  buyer: { kyc: "clear", aml: "clear" },
  buyerSourceOfFunds: "approved",
  buyerOtherOpenExposureMinor: 0,
};
const POLICY = resolvePrivateSalePolicy({
  commissionRateBps: 1500,
  vatTreatments: [{ code: "margin_scheme", label: "Margin scheme" }],
  termsVersion: "v1",
  paymentDueDays: 7,
  collectionDueDays: 14,
});

function setup(deal = makeDeal({ stage: "invoiced" }), write: "ok" | "conflict" = "ok") {
  const events = recordingSink();
  const applyStageChange = vi.fn(async (_id: string, _v: number, change: PrivateSaleStageChange) =>
    write === "ok"
      ? ({ kind: "ok", deal: { ...deal, stage: change.to } } as const)
      : ({ kind: "conflict" } as const),
  );
  const service = new DealTransitionService({
    scope: {
      deals: { findById: async () => deal, applyStageChange } as never,
      events,
    },
    clearance: { snapshot: async () => CLEAR },
    policy: POLICY,
    now: () => new Date("2026-11-04T09:00:00Z"),
  });
  return { service, events, applyStageChange };
}

describe("DealTransitionService", () => {
  it("moves an invoiced deal to paid, with the collection deadline, and publishes the change", async () => {
    const { service, applyStageChange, events } = setup();
    const outcome = await service.transition("deal-1", "mark_paid", { actorUserId: null });
    expect(outcome).toMatchObject({ kind: "ok", deal: { stage: "paid" } });
    expect(applyStageChange).toHaveBeenCalledWith(
      "deal-1",
      4,
      expect.objectContaining({
        from: "invoiced",
        to: "paid",
        changes: { collectionDueAt: new Date("2026-11-18T09:00:00Z") },
      }),
    );
    expect(events.events).toEqual([
      {
        eventType: "private_sale_deal.stage_changed",
        payload: { dealId: "deal-1", reference: "PS-0001", from: "invoiced", to: "paid" },
      },
    ]);
  });

  it("settles a released deal", async () => {
    const { service } = setup(makeDeal({ stage: "released" }));
    expect(await service.transition("deal-1", "settle", { actorUserId: null })).toMatchObject({
      kind: "ok",
      deal: { stage: "settled" },
    });
  });

  it("refuses a move the stage does not allow, and writes nothing", async () => {
    const { service, applyStageChange, events } = setup(makeDeal({ stage: "agreed" }));
    expect(await service.transition("deal-1", "mark_paid", { actorUserId: null })).toEqual({
      kind: "blocked",
      blockers: [{ code: "invalid_transition" }],
    });
    expect(applyStageChange).not.toHaveBeenCalled();
    expect(events.events).toEqual([]);
  });

  it("cancels a paid deal only once the refund is recorded", async () => {
    const { service } = setup(makeDeal({ stage: "paid" }));
    expect(
      await service.transition("deal-1", "cancel", { actorUserId: "u", cancelReason: "withdrew" }),
    ).toEqual({ kind: "blocked", blockers: [{ code: "refund_not_recorded" }] });
    expect(
      await service.transition("deal-1", "cancel", {
        actorUserId: "u",
        cancelReason: "withdrew",
        refundRecorded: true,
      }),
    ).toMatchObject({ kind: "ok", deal: { stage: "cancelled" } });
  });

  it("reports a conflict and publishes nothing when someone else changed the deal", async () => {
    const { service, events } = setup(makeDeal({ stage: "invoiced" }), "conflict");
    expect(await service.transition("deal-1", "mark_paid", { actorUserId: null })).toEqual({
      kind: "conflict",
    });
    expect(events.events).toEqual([]);
  });

  it("writes the move against the version the person saw", async () => {
    const { service, applyStageChange } = setup();
    await service.transition("deal-1", "mark_paid", { actorUserId: null, expectedVersion: 4 });
    expect(applyStageChange).toHaveBeenCalledWith("deal-1", 4, expect.anything());
  });

  it("refuses a move made against an older version, and writes nothing", async () => {
    const { service, applyStageChange, events } = setup();
    expect(
      await service.transition("deal-1", "mark_paid", { actorUserId: null, expectedVersion: 3 }),
    ).toEqual({ kind: "conflict" });
    expect(applyStageChange).not.toHaveBeenCalled();
    expect(events.events).toEqual([]);
  });
});

describe("DealTransitionService and the artwork register", () => {
  const REGISTER_ID = "reg-1";

  function withRegister(deal = makeDeal({ stage: "invoiced", artworkRegisterId: REGISTER_ID })) {
    const events = recordingSink();
    const register = { offer: vi.fn(), withdraw: vi.fn(), markSold: vi.fn() };
    const scope = {
      deals: {
        findById: async () => deal,
        applyStageChange: async (_id: string, _v: number, change: PrivateSaleStageChange) => ({
          kind: "ok" as const,
          deal: { ...deal, stage: change.to },
        }),
      } as never,
      events,
      register,
    };
    const service = new DealTransitionService({
      scope,
      clearance: { snapshot: async () => CLEAR },
      policy: POLICY,
      now: () => new Date("2026-11-04T09:00:00Z"),
    });
    return { service, register };
  }

  it("records the artwork as sold when the deal is paid", async () => {
    const { service, register } = withRegister();
    await service.transition("deal-1", "mark_paid", { actorUserId: null });
    expect(register.markSold).toHaveBeenCalledWith(REGISTER_ID, "deal-1", "system");
    expect(register.withdraw).not.toHaveBeenCalled();
  });

  it("names the staff member who recorded the payment", async () => {
    const { service, register } = withRegister();
    await service.transition("deal-1", "mark_paid", { actorUserId: "u-finance" });
    expect(register.markSold).toHaveBeenCalledWith(REGISTER_ID, "deal-1", "staff:u-finance");
  });

  it("does not undo a payment when the register cannot record the sale", async () => {
    const { service, register } = withRegister();
    register.markSold.mockRejectedValue(new Error("register down"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await service.transition("deal-1", "mark_paid", { actorUserId: null })).toMatchObject({
      kind: "ok",
      deal: { stage: "paid" },
    });
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining("private_sale_register_follow_failed"),
    );
    logged.mockRestore();
  });

  it("ends the artwork's hold when the deal is cancelled", async () => {
    const { service, register } = withRegister(
      makeDeal({ stage: "offer", artworkRegisterId: REGISTER_ID }),
    );
    await service.transition("deal-1", "cancel", { actorUserId: "u", cancelReason: "withdrew" });
    expect(register.withdraw).toHaveBeenCalledWith(REGISTER_ID, "deal-1", "staff:u");
    expect(register.markSold).not.toHaveBeenCalled();
  });

  it("stops a cancellation the register could not record, so no hold is left behind", async () => {
    const { service, register } = withRegister(
      makeDeal({ stage: "offer", artworkRegisterId: REGISTER_ID }),
    );
    register.withdraw.mockRejectedValue(new Error("register down"));
    await expect(
      service.transition("deal-1", "cancel", { actorUserId: "u", cancelReason: "withdrew" }),
    ).rejects.toThrow("register down");
  });

  it("leaves the register alone for stages it does not follow, and for deals with no artwork", async () => {
    const stages = withRegister(makeDeal({ stage: "released", artworkRegisterId: REGISTER_ID }));
    await stages.service.transition("deal-1", "settle", { actorUserId: null });
    expect(stages.register.markSold).not.toHaveBeenCalled();
    expect(stages.register.withdraw).not.toHaveBeenCalled();

    const unlinked = withRegister(makeDeal({ stage: "invoiced", artworkRegisterId: null }));
    await unlinked.service.transition("deal-1", "mark_paid", { actorUserId: null });
    expect(unlinked.register.markSold).not.toHaveBeenCalled();
  });

  it("runs a move that has no transaction of its own inside one, with the register bound to it", async () => {
    const deal = makeDeal({ stage: "offer", artworkRegisterId: REGISTER_ID });
    const register = { offer: vi.fn(), withdraw: vi.fn(), markSold: vi.fn() };
    const scopeForTx = vi.fn(() => ({
      deals: {
        findById: async () => deal,
        applyStageChange: async (_i: string, _v: number, change: PrivateSaleStageChange) => ({
          kind: "ok" as const,
          deal: { ...deal, stage: change.to },
        }),
      } as never,
      events: recordingSink(),
      register,
    }));
    const runInTransaction = vi.fn(async (fn: (tx: never) => Promise<unknown>) => fn({} as never));
    const service = new DealTransitionService({
      scope: { deals: {} as never, events: recordingSink() },
      inTransaction: { runner: { runInTransaction } as never, scopeForTx },
      clearance: { snapshot: async () => CLEAR },
      policy: POLICY,
    });
    await service.transition("deal-1", "cancel", { actorUserId: "u", cancelReason: "withdrew" });
    expect(runInTransaction).toHaveBeenCalledTimes(1);
    expect(register.withdraw).toHaveBeenCalledTimes(1);
  });
});
