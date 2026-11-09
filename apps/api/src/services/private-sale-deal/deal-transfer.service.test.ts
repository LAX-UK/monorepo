import { describe, expect, it, vi } from "vitest";
import { makeDeal, makePayment } from "./deal-fixtures.test-util.js";
import type { DealCheckoutStatus } from "./deal-payment-ports.js";
import { DealTransferService } from "./deal-transfer.service.js";

const invoiced = makeDeal({ stage: "invoiced", priceMinor: 4_800_000 });
const input = {
  dealId: "deal-1",
  recordedByUserId: "u-finance",
  bankReference: "FP 4411",
  amountMinor: 4_800_000,
};

function setup(
  over: {
    deal?: ReturnType<typeof makeDeal>;
    rows?: ReturnType<typeof makePayment>[];
    status?: DealCheckoutStatus | "throws";
    expireThrows?: boolean;
    now?: Date;
  } = {},
) {
  const recordTransferReceived = vi.fn(async () => ({ ok: true, paymentId: "pay-9" }) as const);
  const expireCheckout = vi.fn(async () => {
    if (over.expireThrows) throw new Error("stripe down");
  });
  const checkoutStatus = vi.fn(async () => {
    if (over.status === "throws") throw new Error("stripe down");
    return over.status ?? "expired";
  });
  const service = new DealTransferService({
    deals: { findById: async () => over.deal ?? invoiced },
    payments: {
      listForDeal: async () =>
        over.rows ?? [makePayment({ status: "open", stripeCheckoutSessionId: "cs_1" })],
    },
    checkout: { expireCheckout, checkoutStatus },
    settlement: { recordTransferReceived },
    now: () => over.now ?? new Date("2026-11-04T09:10:00Z"),
  });
  return { service, recordTransferReceived, expireCheckout, checkoutStatus };
}

describe("DealTransferService.record", () => {
  it("ends the buyer's open checkout, reads it back as expired, then records the transfer", async () => {
    const { service, recordTransferReceived, expireCheckout, checkoutStatus } = setup();
    expect(await service.record(input)).toEqual({ ok: true, paymentId: "pay-9" });
    expect(expireCheckout).toHaveBeenCalledWith("cs_1");
    expect(checkoutStatus).toHaveBeenCalledWith("cs_1");
    expect(recordTransferReceived).toHaveBeenCalledWith(input);
  });

  it("records nothing when the buyer finished the checkout as it was being ended", async () => {
    // The race: the card was taken, or a transfer chosen, between the staff click and the expiry.
    const { service, recordTransferReceived } = setup({ status: "complete" });
    expect(await service.record(input)).toEqual({ ok: false, error: "checkout_completed" });
    expect(recordTransferReceived).not.toHaveBeenCalled();
  });

  it.each([
    ["still open after the expiry", { status: "open" as const }],
    ["unreadable", { status: "throws" as const }],
    ["not expirable", { expireThrows: true }],
  ])("records nothing when the checkout is %s", async (_why, over) => {
    const { service, recordTransferReceived } = setup(over);
    expect(await service.record(input)).toEqual({ ok: false, error: "checkout_not_ended" });
    expect(recordTransferReceived).not.toHaveBeenCalled();
  });

  it("leaves the checkout alone when the amount is wrong, so a typo never costs the buyer it", async () => {
    const { service, recordTransferReceived, expireCheckout } = setup();
    await service.record({ ...input, amountMinor: 1 });
    expect(expireCheckout).not.toHaveBeenCalled();
    expect(recordTransferReceived).toHaveBeenCalled();
  });

  it("leaves the checkout alone when the deal is not waiting for payment", async () => {
    const { service, expireCheckout } = setup({
      deal: makeDeal({ stage: "agreed", priceMinor: 4_800_000 }),
    });
    await service.record(input);
    expect(expireCheckout).not.toHaveBeenCalled();
  });

  it("records straight away when the buyer has no open checkout", async () => {
    const { service, recordTransferReceived, expireCheckout } = setup({ rows: [] });
    await service.record(input);
    expect(expireCheckout).not.toHaveBeenCalled();
    expect(recordTransferReceived).toHaveBeenCalledWith(input);
  });

  describe("a checkout that is still being started", () => {
    const started = (createdAt: string) =>
      makePayment({
        status: "open",
        stripeCheckoutSessionId: null,
        createdAt: new Date(createdAt),
      });

    it("is not replaced while its session is not recorded yet: it could be paid a moment from now", async () => {
      const { service, recordTransferReceived, expireCheckout } = setup({
        rows: [started("2026-11-04T09:09:00Z")],
      });
      expect(await service.record(input)).toEqual({ ok: false, error: "checkout_not_ended" });
      expect(expireCheckout).not.toHaveBeenCalled();
      expect(recordTransferReceived).not.toHaveBeenCalled();
    });

    it("is replaced once it has stayed unstarted past the grace", async () => {
      const { service, recordTransferReceived, expireCheckout } = setup({
        rows: [started("2026-11-04T09:07:59Z")],
      });
      expect(await service.record(input)).toEqual({ ok: true, paymentId: "pay-9" });
      expect(expireCheckout).not.toHaveBeenCalled();
      expect(recordTransferReceived).toHaveBeenCalledWith(input);
    });

    it("is waited for only when the transfer is the right amount for a deal waiting for payment", async () => {
      const { service, recordTransferReceived } = setup({
        rows: [started("2026-11-04T09:09:00Z")],
      });
      await service.record({ ...input, amountMinor: 1 });
      expect(recordTransferReceived).toHaveBeenCalled();
    });
  });
});
