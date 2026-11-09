import { describe, expect, it, vi } from "vitest";
import { LotFulfilmentPaymentSync } from "./lot-fulfilment-payment-sync.js";

const NOW = new Date("2026-11-09T10:00:00Z");

function setup(existing: { status: string; paymentClearedAt?: Date | null } | null) {
  const store = {
    findByLotId: vi.fn().mockResolvedValue(existing),
    insert: vi.fn().mockResolvedValue(undefined),
    updateByLotId: vi.fn().mockResolvedValue(undefined),
  };
  return { store, sync: new LotFulfilmentPaymentSync(store as never, () => NOW) };
}

describe("recording when payment cleared", () => {
  it("stamps a new fulfilment record with the clearance time", async () => {
    const { store, sync } = setup(null);
    await sync.onPaymentCaptured("lot-1", "pay-1");
    expect(store.insert).toHaveBeenCalledWith({
      lotId: "lot-1",
      paymentId: "pay-1",
      status: "awaiting_release",
      paymentClearedAt: NOW,
    });
  });

  it("stamps a record that was waiting for payment", async () => {
    const { store, sync } = setup({ status: "awaiting_payment" });
    await sync.onPaymentCaptured("lot-1", "pay-1");
    expect(store.updateByLotId).toHaveBeenCalledWith("lot-1", {
      paymentId: "pay-1",
      status: "awaiting_release",
      paymentClearedAt: NOW,
      updatedAt: NOW,
    });
  });

  it("keeps the first clearance time when a payment is captured again", async () => {
    const first = new Date("2026-11-01T09:00:00Z");
    const { store, sync } = setup({ status: "awaiting_release", paymentClearedAt: first });
    await sync.onPaymentCaptured("lot-1", "pay-2");
    const patch = store.updateByLotId.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(patch).not.toHaveProperty("paymentClearedAt");
  });

  it("leaves a record that has moved on alone", async () => {
    const { store, sync } = setup({ status: "released" });
    await sync.onPaymentCaptured("lot-1", "pay-1");
    expect(store.updateByLotId).not.toHaveBeenCalled();
    expect(store.insert).not.toHaveBeenCalled();
  });
});
