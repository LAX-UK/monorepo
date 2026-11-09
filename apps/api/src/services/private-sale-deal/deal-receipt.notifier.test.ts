import { describe, expect, it, vi } from "vitest";
import { makeDeal, makePayment } from "./deal-fixtures.test-util.js";
import { DealReceiptNotifier } from "./deal-receipt.notifier.js";

function setup(
  over: { payment?: ReturnType<typeof makePayment> | null; dispatcher?: boolean } = {},
) {
  const dispatch = vi.fn(async () => undefined);
  const payment =
    over.payment === undefined ? makePayment({ status: "paid", rail: "card" }) : over.payment;
  const notifier = new DealReceiptNotifier({
    payments: { findById: async () => payment },
    deals: { findById: async () => makeDeal() },
    works: {
      findWorkSummary: async () => ({
        title: "Harbour at dusk",
        reference: "C-1042",
        legalEntityId: "le-seller",
      }),
    },
    dispatcher: over.dispatcher === false ? null : { dispatch },
  });
  return { notifier, dispatch };
}

describe("DealReceiptNotifier", () => {
  it("sends the buyer a payment received notice with the amount, the work and how they paid", async () => {
    const { notifier, dispatch } = setup();
    await notifier.send({ paymentId: "pay-1" });
    expect(dispatch).toHaveBeenCalledTimes(1);
    const [userId, payload] = dispatch.mock.calls[0] as unknown as [
      string,
      { meta: Record<string, unknown> },
    ];
    expect(userId).toBe("u-buyer");
    expect(payload).toMatchObject({
      type: "payment_received",
      meta: {
        audience: "buyer",
        amount: "48000.00",
        currency: "GBP",
        lotTitle: "Harbour at dusk",
        paymentMethod: "card",
        emailIdempotencyKey: "private_sale_receipt:pay-1",
      },
    });
  });

  it("calls a bank transfer a bank transfer, and sends to the person acting for the buyer", async () => {
    const { notifier, dispatch } = setup({
      payment: makePayment({ status: "paid", rail: "gb_bank_transfer", createdByUserId: null }),
    });
    await notifier.send({ paymentId: "pay-1" });
    const [userId, payload] = dispatch.mock.calls[0] as unknown as [
      string,
      { meta: Record<string, unknown> },
    ];
    expect(userId).toBe("u-buyer");
    expect(payload.meta.paymentMethod).toBe("bank_transfer");
  });

  it("sends nothing for a payment that is not paid, or where notices are not sent", async () => {
    const unpaid = setup({ payment: makePayment({ status: "open" }) });
    await unpaid.notifier.send({ paymentId: "pay-1" });
    expect(unpaid.dispatch).not.toHaveBeenCalled();
    const off = setup({ dispatcher: false });
    await expect(off.notifier.send({ paymentId: "pay-1" })).resolves.toBeUndefined();
  });
});
