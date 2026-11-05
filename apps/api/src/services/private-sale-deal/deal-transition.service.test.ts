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
});
