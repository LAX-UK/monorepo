import { describe, expect, it, vi } from "vitest";
import { DealSettlementFollowUpService } from "./deal-settlement-follow-up.service.js";

const row = (dealId: string, severity: "normal" | "urgent") => ({
  dealId,
  reference: `PS-${dealId}`,
  ownerUserId: "u",
  severity,
  updatedAt: new Date("2026-11-30T16:00:00Z"),
});

function setup(rows: ReturnType<typeof row>[], limitSpy = vi.fn()) {
  const published: { aggregateId: string; eventType: string; payload: unknown }[] = [];
  const raisedBefore = new Set<string>();
  const service = new DealSettlementFollowUpService({
    queries: {
      listSettlementFollowUps: vi.fn(async (...args: unknown[]) => {
        limitSpy(...args);
        return rows;
      }),
    },
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
      claimInTransaction: async (_tx: unknown, dealId: string, severity: string) => {
        // Raised as urgent covers everything; raised as normal covers only normal.
        const key = `${dealId}:${severity}`;
        if (raisedBefore.has(`${dealId}:urgent`) || raisedBefore.has(key)) return false;
        raisedBefore.add(key);
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

  it("asks only for deals not yet raised at their severity, and says when the window is full", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const spy = vi.fn();
    const full = Array.from({ length: 500 }, (_, i) => row(String(i), "normal"));
    const { service } = setup(full, spy);
    await service.raiseNew();
    expect(spy).toHaveBeenCalledWith({ kind: "all" }, 500, { unraisedOnly: true });
    expect(errors.mock.calls.flat().join(" ")).toContain(
      "private_sale_settlement_follow_up_check_truncated",
    );
  });

  it("raises a deal again, once, when it becomes urgent after being raised as normal", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    let severity: "normal" | "urgent" = "normal";
    const published: string[] = [];
    const raised = new Set<string>();
    const service = new DealSettlementFollowUpService({
      queries: { listSettlementFollowUps: async () => [row("1", severity)] },
      transactionRunner: {
        runInTransaction: async (work: (tx: never) => Promise<unknown>) => work({} as never),
      } as never,
      eventsForTx: () =>
        ({
          publish: async (e: { payload: { severity: string } }) =>
            void published.push(e.payload.severity),
        }) as never,
      raised: {
        claimInTransaction: async (_tx: unknown, id: string, sev: string) => {
          if (raised.has(`${id}:urgent`) || raised.has(`${id}:${sev}`)) return false;
          raised.add(`${id}:${sev}`);
          return true;
        },
      },
    });
    await service.raiseNew();
    await service.raiseNew();
    severity = "urgent";
    await service.raiseNew();
    await service.raiseNew();
    expect(published).toEqual(["normal", "urgent"]);
  });
});
