import { describe, expect, it, vi } from "vitest";
import {
  DELIVERY_REFUND_REQUESTED_EVENT,
  PaymentGroupDeliveryRefundService,
  type RefundDeliveryInput,
} from "./payment-group-delivery-refund.service.js";

const GROUP_ID = "5d2f7c1a-9e3b-4f60-8a1d-3b7c9e2f4a61";
const QUOTE_ID = "8c4e2a17-3f5b-4d9e-b1a6-7e2c9f3d5b80";

const group = (over: Record<string, unknown> = {}) => ({
  id: GROUP_ID,
  buyerLegalEntityId: "buyer-1",
  status: "paid",
  currency: "GBP",
  stripeChargeId: "ch_group",
  ...over,
});

function setup(
  opts: {
    group?: Record<string, unknown> | null;
    refundedPence?: number;
    stripeRefunds?: { deliveryQuoteId: string | null; amountPence: number; status: string }[];
    refundStatus?: string;
    alreadyRefunded?: boolean;
  } = {},
) {
  const createRefund = vi.fn(async (input: { amount?: number }) =>
    opts.alreadyRefunded
      ? ({ kind: "already_refunded" } as const)
      : ({
          kind: "created",
          refundId: "re_courier",
          status: opts.refundStatus ?? "succeeded",
          amountPence: input.amount ?? 0,
        } as const),
  );
  const publish = vi.fn().mockResolvedValue(undefined);
  const lockInTransaction = vi.fn(async () =>
    opts.group === null
      ? null
      : {
          group: group(opts.group ?? {}),
          members: [{ paymentId: "pay-a", amount: "100.00", sellerLegalEntityId: "seller-1" }],
          deliveries: [
            {
              quoteId: QUOTE_ID,
              lotId: "lot-1",
              amount: "180.00",
              refundedPence: opts.refundedPence ?? 0,
            },
          ],
          refundUnattributedPence: 0,
        },
  );
  const service = new PaymentGroupDeliveryRefundService({
    transactionRunner: {
      runInTransaction: async <T>(fn: (tx: never) => Promise<T>) => fn({} as never),
    } as never,
    groups: { lockInTransaction } as never,
    stripe: { isConfigured: () => true, createRefund },
    chargeRefunds: {
      listChargeRefunds: vi.fn(async () =>
        (opts.stripeRefunds ?? []).map((r, i) => ({
          id: `re_${i}`,
          chargeId: "ch_group",
          paymentId: null,
          ...r,
        })),
      ),
    },
    events: { publish, withTx: () => ({ publish }) } as never,
  });
  return { service, createRefund, publish };
}

const input = (over: Partial<RefundDeliveryInput> = {}): RefundDeliveryInput => ({
  actorUserId: "staff-1",
  role: "staff",
  staffRoles: ["administrator"],
  paymentGroupId: GROUP_ID,
  deliveryQuoteId: QUOTE_ID,
  reason: "Buyer collected the lot in person instead.",
  ...over,
});

describe("PaymentGroupDeliveryRefundService", () => {
  it("refunds the rest of the courier charge against the group's charge, naming the quote", async () => {
    const { service, createRefund, publish } = setup();
    const result = await service.refundDelivery(input());
    expect(result.isOk()).toBe(true);
    expect(createRefund).toHaveBeenCalledWith({
      chargeId: "ch_group",
      amount: 18_000,
      reason: "requested_by_customer",
      deliveryQuoteId: QUOTE_ID,
      sequence: 0,
    });
    // Never an invoice's payment: that is what keeps the seller's payout out of it.
    expect(createRefund.mock.calls[0]?.[0]).not.toHaveProperty("paymentId");
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: DELIVERY_REFUND_REQUESTED_EVENT,
        aggregateType: "payment_group",
        aggregateId: GROUP_ID,
        actorUserId: "staff-1",
        payload: expect.objectContaining({
          deliveryQuoteId: QUOTE_ID,
          stripeRefundId: "re_courier",
          amountCents: 18_000,
          staffReason: "Buyer collected the lot in person instead.",
        }),
      }),
    );
  });

  it("refunds part of the courier charge, keyed by what had already gone back", async () => {
    const { service, createRefund } = setup({ refundedPence: 5_000 });
    const result = await service.refundDelivery(input({ amountPence: 3_000 }));
    expect(result.isOk()).toBe(true);
    expect(createRefund).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 3_000, sequence: 5_000 }),
    );
  });

  it("refuses more than what is left, counting a refund Stripe is still processing", async () => {
    const { service, createRefund } = setup({
      refundedPence: 0,
      stripeRefunds: [{ deliveryQuoteId: QUOTE_ID, amountPence: 15_000, status: "pending" }],
    });
    const result = await service.refundDelivery(input({ amountPence: 5_000 }));
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().status).toBe(400);
    expect(createRefund).not.toHaveBeenCalled();
  });

  it("ignores refunds of invoices and failed refunds when working out what is left", async () => {
    const { service, createRefund } = setup({
      stripeRefunds: [
        { deliveryQuoteId: null, amountPence: 10_000, status: "succeeded" },
        { deliveryQuoteId: QUOTE_ID, amountPence: 18_000, status: "failed" },
      ],
    });
    await service.refundDelivery(input());
    expect(createRefund).toHaveBeenCalledWith(expect.objectContaining({ amount: 18_000 }));
  });

  it("refuses a courier charge that has already gone back in full", async () => {
    const { service, createRefund } = setup({ refundedPence: 18_000 });
    const result = await service.refundDelivery(input());
    expect(result._unsafeUnwrapErr().status).toBe(409);
    expect(createRefund).not.toHaveBeenCalled();
  });

  it("refuses a payment that is not paid, or a quote it did not charge", async () => {
    const open = setup({ group: { status: "open", stripeChargeId: null } });
    expect((await open.service.refundDelivery(input()))._unsafeUnwrapErr().status).toBe(409);
    expect(open.createRefund).not.toHaveBeenCalled();

    const other = setup();
    const wrongQuote = await other.service.refundDelivery(
      input({ deliveryQuoteId: "3a9b1c2d-4e5f-4a6b-8c7d-9e0f1a2b3c4d" }),
    );
    expect(wrongQuote._unsafeUnwrapErr().status).toBe(404);

    const missing = setup({ group: null });
    expect((await missing.service.refundDelivery(input()))._unsafeUnwrapErr().status).toBe(404);
  });

  it("is for finance staff only", async () => {
    const { service, createRefund } = setup();
    const result = await service.refundDelivery(input({ role: "client", staffRoles: undefined }));
    expect(result._unsafeUnwrapErr().status).toBe(403);
    expect(createRefund).not.toHaveBeenCalled();
  });

  it("reports a refund Stripe did not make, and writes no audit event for it", async () => {
    const { service, publish } = setup({ refundStatus: "failed" });
    const result = await service.refundDelivery(input());
    expect(result._unsafeUnwrapErr().status).toBe(502);
    expect(publish).not.toHaveBeenCalled();
  });
});
