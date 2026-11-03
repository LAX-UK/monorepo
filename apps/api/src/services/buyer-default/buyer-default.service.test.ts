import {
  BuyerDefaultConflictError,
  type BuyerDefaultLotFacts,
} from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { NotificationFactory } from "../notification.factory.js";
import { BuyerDefaultService, type BuyerDefaultServiceDeps } from "./buyer-default.service.js";

const salesManager = {
  userId: "staff-1",
  role: "staff" as const,
  staffRoles: ["sales_manager" as const],
};
const finance = { userId: "staff-2", role: "staff" as const, staffRoles: ["finance" as const] };
const clientServices = {
  userId: "staff-3",
  role: "staff" as const,
  staffRoles: ["client_services" as const],
};

function facts(over: Partial<BuyerDefaultLotFacts> = {}): BuyerDefaultLotFacts {
  return {
    lot: {
      id: "lot-1",
      title: "Harbour at dusk",
      lotNumber: 4,
      status: "ended",
      saleId: "sale-1",
      winnerId: "buyer-1",
      buyerLegalEntityId: "ent-buyer",
      sellerLegalEntityId: "ent-seller",
      hammerPrice: "1000.00",
      wonAt: new Date("2026-11-01T10:00:00Z"),
    },
    payment: {
      id: "pay-1",
      status: "pending",
      amount: "1200.00",
      raisedAt: new Date("2026-11-01T10:00:00Z"),
    },
    fulfilmentStatus: "awaiting_payment",
    hasOpenDispute: false,
    bids: [
      { userId: "buyer-1", legalEntityId: "ent-buyer", amount: "1000.00" },
      { userId: "under-1", legalEntityId: "ent-under", amount: "900.00" },
    ],
    ...over,
  };
}

function setup(lotFacts: BuyerDefaultLotFacts | null = facts()) {
  const order: string[] = [];
  const tx = {} as never;
  const deps = {
    reader: { readFacts: vi.fn().mockResolvedValue(lotFacts) },
    repository: {
      record: vi.fn(async () => {
        order.push("void");
        return { id: "def-1" };
      }),
      isVoided: vi.fn(),
    },
    transactionRunner: { runInTransaction: vi.fn(async (fn: (t: never) => unknown) => fn(tx)) },
    transitions: { resetLotForInventoryReturn: vi.fn(async () => void order.push("reset")) },
    recorder: {
      recordBuyerDefaulted: vi.fn(async () => void order.push("audit")),
      recordReturnedToInventory: vi.fn(async () => void order.push("returned")),
    },
    suspender: { suspendMany: vi.fn().mockResolvedValue(undefined) },
    dispatcher: { dispatch: vi.fn().mockResolvedValue(undefined) },
    factory: new NotificationFactory(),
    recipients: { listUserIdsForAudience: vi.fn().mockResolvedValue(["seller-user"]) },
    closeCheckout: vi.fn().mockResolvedValue(undefined),
    events: { publish: vi.fn().mockResolvedValue(undefined) },
    jobScheduler: { cancelLotJobs: vi.fn().mockResolvedValue(undefined) },
  };
  const service = new BuyerDefaultService(deps as unknown as BuyerDefaultServiceDeps);
  return { service, deps, order };
}

const input = {
  outcome: "returned_to_inventory" as const,
  reason: "No reply after two weeks",
  restrictBidding: false,
};

describe("BuyerDefaultService permissions and guards", () => {
  it("lets a sales manager and finance record a default, and no one else", async () => {
    expect((await setup().service.record(salesManager, "lot-1", input)).isOk()).toBe(true);
    expect((await setup().service.record(finance, "lot-1", input)).isOk()).toBe(true);
    const denied = await setup().service.record(clientServices, "lot-1", input);
    expect(denied.isErr() && denied.error.status).toBe(403);
  });

  it("requires a reason", async () => {
    const { service, deps } = setup();
    const result = await service.record(salesManager, "lot-1", { ...input, reason: "  " });
    expect(result.isErr()).toBe(true);
    expect(deps.repository.record).not.toHaveBeenCalled();
  });

  it("refuses a lot that is paid, held for checks or not found", async () => {
    for (const status of ["captured", "requires_manual_review"] as const) {
      const { service, deps } = setup(
        facts({ payment: { id: "p", status, amount: "1", raisedAt: new Date() } }),
      );
      const result = await service.record(salesManager, "lot-1", input);
      expect(result.isErr() && result.error.status).toBe(409);
      expect(deps.repository.record).not.toHaveBeenCalled();
    }
    const missing = await setup(null).service.record(salesManager, "lot-1", input);
    expect(missing.isErr() && missing.error.status).toBe(404);
  });

  it("reports a conflict when the lot or invoice changed in the meantime", async () => {
    const { service, deps } = setup();
    deps.repository.record.mockRejectedValueOnce(new BuyerDefaultConflictError());
    const result = await service.record(salesManager, "lot-1", input);
    expect(result.isErr() && result.error.status).toBe(409);
    expect(deps.dispatcher.dispatch).not.toHaveBeenCalled();
  });
});

describe("BuyerDefaultService void and outcome", () => {
  it("voids the invoice, audits, then returns the lot to inventory in one transaction", async () => {
    const { service, deps, order } = setup();
    const result = await service.record(salesManager, "lot-1", input);
    expect(result._unsafeUnwrap()).toEqual({ id: "def-1", outcome: "returned_to_inventory" });
    expect(order).toEqual(["void", "audit", "reset", "returned"]);
    expect(deps.transactionRunner.runInTransaction).toHaveBeenCalledTimes(1);
    expect(deps.repository.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        paymentId: "pay-1",
        buyerId: "buyer-1",
        reason: "No reply after two weeks",
        actorUserId: "staff-1",
      }),
    );
    expect(deps.closeCheckout).toHaveBeenCalledWith("pay-1");
    expect(deps.jobScheduler.cancelLotJobs).toHaveBeenCalledWith("lot-1");
  });

  it("records an offer to the underbidder without resetting the lot, and tells them", async () => {
    const { service, deps, order } = setup();
    await service.record(salesManager, "lot-1", { ...input, outcome: "offered_to_underbidder" });
    expect(order).toEqual(["void", "audit"]);
    expect(deps.repository.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ offeredUserId: "under-1", offeredAmount: "900.00" }),
    );
    const audiences = deps.dispatcher.dispatch.mock.calls.map((c) => c[1].meta.audience);
    expect(audiences.sort()).toEqual(["buyer", "seller", "underbidder"]);
  });

  it("refuses an offer when nobody else bid", async () => {
    const { service } = setup(
      facts({ bids: [{ userId: "buyer-1", legalEntityId: "ent-buyer", amount: "1000.00" }] }),
    );
    const result = await service.record(salesManager, "lot-1", {
      ...input,
      outcome: "offered_to_underbidder",
    });
    expect(result.isErr() && result.error.code).toBe("no_underbidder");
  });

  it("works for a lot with no invoice yet", async () => {
    const { service, deps } = setup(facts({ payment: null, fulfilmentStatus: null }));
    expect((await service.record(salesManager, "lot-1", input)).isOk()).toBe(true);
    expect(deps.closeCheckout).not.toHaveBeenCalled();
  });
});

describe("BuyerDefaultService notices and restriction", () => {
  it("tells the buyer and the seller, with the same words as the email", async () => {
    const { service, deps } = setup();
    await service.record(salesManager, "lot-1", input);
    const sent = deps.dispatcher.dispatch.mock.calls.map(([userId, payload]) => [
      userId,
      payload.title,
    ]);
    expect(sent).toEqual([
      ["buyer-1", "Your purchase was cancelled: Harbour at dusk"],
      ["seller-user", "The buyer did not pay: Harbour at dusk"],
    ]);
  });

  it("restricts bidding only when asked", async () => {
    const without = setup();
    await without.service.record(salesManager, "lot-1", input);
    expect(without.deps.suspender.suspendMany).not.toHaveBeenCalled();

    const withIt = setup();
    await withIt.service.record(salesManager, "lot-1", { ...input, restrictBidding: true });
    expect(withIt.deps.suspender.suspendMany).toHaveBeenCalledWith(
      expect.objectContaining({ userIds: ["buyer-1"], actorUserId: "staff-1" }),
    );
  });

  it("keeps the void when a notice cannot be sent", async () => {
    const { service, deps } = setup();
    deps.dispatcher.dispatch.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await service.record(salesManager, "lot-1", input)).isOk()).toBe(true);
  });
});
