import { describe, expect, it, vi } from "vitest";
import { makeDeal, makePayment } from "./deal-fixtures.test-util.js";
import { DealTransferService } from "./deal-transfer.service.js";

const invoiced = makeDeal({ stage: "invoiced", priceMinor: 4_800_000 });
const input = {
  dealId: "deal-1",
  recordedByUserId: "u-finance",
  bankReference: "FP 4411",
  amountMinor: 4_800_000,
};

function setup(
  deal = invoiced,
  rows = [makePayment({ status: "open", stripeCheckoutSessionId: "cs_1" })],
) {
  const recordTransferReceived = vi.fn(async () => ({ ok: true, paymentId: "pay-9" }) as const);
  const expireCheckout = vi.fn(async () => undefined);
  const service = new DealTransferService({
    deals: { findById: async () => deal },
    payments: { listForDeal: async () => rows },
    checkout: { expireCheckout },
    settlement: { recordTransferReceived },
  });
  return { service, recordTransferReceived, expireCheckout };
}

describe("DealTransferService.record", () => {
  it("ends the buyer's open checkout before it records a transfer for the right amount", async () => {
    const { service, recordTransferReceived, expireCheckout } = setup();
    expect(await service.record(input)).toEqual({ ok: true, paymentId: "pay-9" });
    expect(expireCheckout).toHaveBeenCalledWith("cs_1");
    expect(recordTransferReceived).toHaveBeenCalledWith(input);
  });

  it("leaves the checkout alone when the amount is wrong, so a typo never costs the buyer it", async () => {
    const { service, recordTransferReceived, expireCheckout } = setup();
    await service.record({ ...input, amountMinor: 1 });
    expect(expireCheckout).not.toHaveBeenCalled();
    expect(recordTransferReceived).toHaveBeenCalled();
  });

  it("leaves the checkout alone when the deal is not waiting for payment", async () => {
    const { service, expireCheckout } = setup(makeDeal({ stage: "agreed", priceMinor: 4_800_000 }));
    await service.record(input);
    expect(expireCheckout).not.toHaveBeenCalled();
  });
});
