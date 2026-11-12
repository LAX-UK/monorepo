import { describe, expect, it, vi } from "vitest";
import { DealSettlementFollowUpService } from "./deal-settlement-follow-up.service.js";

const row = (dealId: string, severity: "normal" | "urgent") => ({
  dealId,
  reference: `PS-${dealId}`,
  ownerUserId: "u",
  severity,
  updatedAt: new Date("2026-11-30T16:00:00Z"),
});

function setup(rows: ReturnType<typeof row>[]) {
  const published: { aggregateId: string; eventType: string; payload: unknown }[] = [];
  const raisedBefore = new Set<string>();
  const service = new DealSettlementFollowUpService({
    queries: { listSettlementFollowUps: vi.fn(async () => rows) },
    transactionRunner: {
      runInTransaction: async <T>(work: (tx: never) => Promise<T>) => work({} as never),
    } as never,
    eventsForTx: () =>
      ({
        publish: async (event: (typeof published)[number]) => {
          published.push(event);
        },
      }) as never,
    raised: {
      claimInTransaction: async (_tx: unknown, dealId: string) => {
        if (raisedBefore.has(dealId)) return false;
        raisedBefore.add(dealId);
        return true;
      },
    },
  });
  return { service, published };
}

describe("DealSettlementFollowUpService", () => {
  it("raises each open deal once, however often the check runs", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { service, published } = setup([row("1", "normal"), row("2", "urgent")]);
    expect(await service.raiseNew()).toEqual({ open: 2, raised: 2, urgent: 1 });
    expect(await service.raiseNew()).toEqual({ open: 2, raised: 0, urgent: 1 });
    expect(published.map((e) => e.aggregateId)).toEqual(["1", "2"]);
    expect(published[1]).toMatchObject({
      eventType: "private_sale_deal.settlement_follow_up_raised",
      payload: { dealId: "2", severity: "urgent" },
    });
  });

  it("does nothing when every settled deal's artwork is recorded sold", async () => {
    const { service, published } = setup([]);
    expect(await service.raiseNew()).toEqual({ open: 0, raised: 0, urgent: 0 });
    expect(published).toEqual([]);
  });

  it("carries on with the other deals when one cannot be raised", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    let attempts = 0;
    const service = new DealSettlementFollowUpService({
      queries: { listSettlementFollowUps: async () => [row("1", "normal"), row("2", "normal")] },
      transactionRunner: {
        runInTransaction: async (work: (tx: never) => Promise<unknown>) => {
          attempts += 1;
          if (attempts === 1) throw new Error("database busy");
          return work({} as never);
        },
      } as never,
      eventsForTx: () => ({ publish: async () => undefined }) as never,
      raised: { claimInTransaction: async () => true },
    });
    expect(await service.raiseNew()).toEqual({ open: 2, raised: 1, urgent: 0 });
  });
});
