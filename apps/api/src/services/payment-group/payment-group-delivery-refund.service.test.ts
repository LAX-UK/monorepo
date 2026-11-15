import type {
  DeliveryRefundRequest,
  IPaymentGroupDeliveryRefundRepository,
} from "@auction/persistence/interfaces";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import {
  DELIVERY_REFUND_REQUESTED_EVENT,
  PaymentGroupDeliveryRefundService,
  type RefundDeliveryInput,
  UNSENT_REQUEST_RELEASE_MS,
} from "./payment-group-delivery-refund.service.js";

const GROUP_ID = "5d2f7c1a-9e3b-4f60-8a1d-3b7c9e2f4a61";
const QUOTE_ID = "8c4e2a17-3f5b-4d9e-b1a6-7e2c9f3d5b80";
const NOW = new Date("2026-11-15T12:00:00Z");

const group = (over: Record<string, unknown> = {}) => ({
  id: GROUP_ID,
  buyerLegalEntityId: "buyer-1",
  status: "paid",
  currency: "GBP",
  stripeChargeId: "ch_group",
  ...over,
});

/** The request table, in memory. */
function memoryRequests(initial: DeliveryRefundRequest[] = []) {
  const rows = initial.map((r) => ({ ...r }));
  let next = 0;
  const repo: IPaymentGroupDeliveryRefundRepository = {
    listForQuoteInTransaction: async (_tx, groupId, quoteId) =>
      rows
        .filter((r) => r.paymentGroupId === groupId && r.deliveryQuoteId === quoteId)
        .map((r) => ({ ...r })),
    insertInTransaction: async (_tx, input) => {
      next += 1;
      const row: DeliveryRefundRequest = {
        id: `req-${next}`,
        ...input,
        status: "pending",
        stripeRefundId: null,
        stripeStatus: null,
        createdAt: NOW,
      };
      rows.push(row);
      return { ...row };
    },
    recordOutcome: async (_conn, id, outcome) => {
      const row = rows.find((r) => r.id === id);
      if (!row) return false;
      Object.assign(row, outcome);
      return true;
    },
    releaseUnsentInTransaction: async (_tx, id) => {
      const row = rows.find((r) => r.id === id);
      if (!row || row.status !== "pending" || row.stripeRefundId !== null) return false;
      row.status = "failed";
      return true;
    },
  };
  return { repo, rows };
}

const request = (over: Partial<DeliveryRefundRequest>): DeliveryRefundRequest => ({
  id: "req-old",
  paymentGroupId: GROUP_ID,
  deliveryQuoteId: QUOTE_ID,
  amountPence: 5_000,
  status: "pending",
  staffReason: "Earlier request.",
  actorUserId: "staff-2",
  stripeRefundId: null,
  stripeStatus: null,
  createdAt: NOW,
  ...over,
});

function setup(
  opts: {
    group?: Record<string, unknown> | null;
    refundedPence?: number;
    stripeRefunds?: {
      id?: string;
      deliveryQuoteId: string | null;
      amountPence: number;
      status: string;
      deliveryRefundId?: string | null;
    }[];
    refundStatus?: string;
    alreadyRefunded?: boolean;
    refundThrows?: unknown;
    requests?: DeliveryRefundRequest[];
  } = {},
) {
  const createRefund = vi.fn(async (input: { amount?: number }) => {
    if (opts.refundThrows) throw opts.refundThrows;
    return opts.alreadyRefunded
      ? ({ kind: "already_refunded" } as const)
      : ({
          kind: "created",
          refundId: "re_courier",
          status: opts.refundStatus ?? "succeeded",
          amountPence: input.amount ?? 0,
        } as const);
  });
  const publish = vi.fn().mockResolvedValue(undefined);
  const txPublish = vi.fn().mockResolvedValue(undefined);
  const theGroup = opts.group === null ? null : group(opts.group ?? {});
  const lockInTransaction = vi.fn(async () =>
    theGroup === null
      ? null
      : {
          group: theGroup,
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
  const requests = memoryRequests(opts.requests);
  const service = new PaymentGroupDeliveryRefundService({
    transactionRunner: {
      runInTransaction: async <T>(fn: (tx: never) => Promise<T>) => fn({} as never),
    } as never,
    groups: { lockInTransaction, findById: async () => theGroup } as never,
    requests: requests.repo,
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
    events: { publish, withTx: () => ({ publish: txPublish }) } as never,
    now: () => NOW,
  });
  return { service, createRefund, publish, txPublish, rows: requests.rows };
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
  it("reserves the rest of the courier charge, then refunds it naming the quote and the request", async () => {
    const { service, createRefund, publish, txPublish, rows } = setup();
    const result = await service.refundDelivery(input());
    expect(result.isOk()).toBe(true);
    expect(createRefund).toHaveBeenCalledWith({
      chargeId: "ch_group",
      amount: 18_000,
      reason: "requested_by_customer",
      deliveryQuoteId: QUOTE_ID,
      deliveryRefundId: "req-1",
    });
    // Never an invoice's payment: that is what keeps the seller's payout out of it.
    expect(createRefund.mock.calls[0]?.[0]).not.toHaveProperty("paymentId");
    // The audit event is written with the request, in its transaction, before Stripe is asked.
    expect(publish).not.toHaveBeenCalled();
    expect(txPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: DELIVERY_REFUND_REQUESTED_EVENT,
        aggregateType: "payment_group",
        aggregateId: GROUP_ID,
        actorUserId: "staff-1",
        payload: expect.objectContaining({
          deliveryQuoteId: QUOTE_ID,
          deliveryRefundId: "req-1",
          amountCents: 18_000,
          staffReason: "Buyer collected the lot in person instead.",
        }),
      }),
    );
    expect(rows).toEqual([
      expect.objectContaining({
        id: "req-1",
        amountPence: 18_000,
        status: "succeeded",
        stripeRefundId: "re_courier",
        staffReason: "Buyer collected the lot in person instead.",
      }),
    ]);
  });

  it("refunds part of the courier charge", async () => {
    const { service, createRefund } = setup({ refundedPence: 5_000 });
    const result = await service.refundDelivery(input({ amountPence: 3_000 }));
    expect(result.isOk()).toBe(true);
    expect(createRefund).toHaveBeenCalledWith(expect.objectContaining({ amount: 3_000 }));
  });

  it("counts a request still in flight, which Stripe does not list yet, as taken", async () => {
    const { service, createRefund } = setup({
      requests: [request({ amountPence: 15_000 })],
    });
    const result = await service.refundDelivery(input({ amountPence: 5_000 }));
    expect(result._unsafeUnwrapErr().status).toBe(400);
    expect(result._unsafeUnwrapErr().message).toContain("£30.00");
    expect(createRefund).not.toHaveBeenCalled();
  });

  it("does not count a request twice when Stripe lists its refund", async () => {
    const { service, createRefund, rows } = setup({
      requests: [request({ amountPence: 5_000 })],
      stripeRefunds: [
        {
          id: "re_old",
          deliveryQuoteId: QUOTE_ID,
          deliveryRefundId: "req-old",
          amountPence: 5_000,
          status: "succeeded",
        },
      ],
    });
    await service.refundDelivery(input());
    expect(createRefund).toHaveBeenCalledWith(expect.objectContaining({ amount: 13_000 }));
    // The earlier request learns Stripe's answer from the list.
    expect(rows[0]).toMatchObject({ status: "succeeded", stripeRefundId: "re_old" });
  });

  it("frees a request whose refund Stripe lists as failed or cancelled", async () => {
    const { service, createRefund, rows } = setup({
      requests: [
        request({ amountPence: 18_000, stripeRefundId: "re_old", stripeStatus: "pending" }),
      ],
      stripeRefunds: [
        { id: "re_old", deliveryQuoteId: QUOTE_ID, amountPence: 18_000, status: "canceled" },
      ],
    });
    const result = await service.refundDelivery(input());
    expect(result.isOk()).toBe(true);
    expect(createRefund).toHaveBeenCalledWith(expect.objectContaining({ amount: 18_000 }));
    expect(rows[0]).toMatchObject({ status: "failed", stripeStatus: "canceled" });
  });

  it("frees a request that never reached Stripe once it is old enough, and not before", async () => {
    const fresh = setup({ requests: [request({ amountPence: 18_000, actorUserId: "staff-2" })] });
    expect((await fresh.service.refundDelivery(input()))._unsafeUnwrapErr().status).toBe(409);
    expect(fresh.createRefund).not.toHaveBeenCalled();

    const stale = setup({
      requests: [
        request({
          amountPence: 18_000,
          createdAt: new Date(NOW.getTime() - UNSENT_REQUEST_RELEASE_MS - 1),
        }),
      ],
    });
    expect((await stale.service.refundDelivery(input())).isOk()).toBe(true);
    expect(stale.rows[0]?.status).toBe("failed");
  });

  it("takes the same amount from the same person moments later as a repeat", async () => {
    const { service, createRefund } = setup({
      requests: [request({ amountPence: 3_000, actorUserId: "staff-1", stripeRefundId: "re_x" })],
      stripeRefunds: [
        { id: "re_x", deliveryQuoteId: QUOTE_ID, amountPence: 3_000, status: "succeeded" },
      ],
    });
    const result = await service.refundDelivery(input({ amountPence: 3_000 }));
    expect(result._unsafeUnwrapErr().status).toBe(409);
    expect(createRefund).not.toHaveBeenCalled();
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
    const { service, createRefund, rows } = setup({ refundedPence: 18_000 });
    const result = await service.refundDelivery(input());
    expect(result._unsafeUnwrapErr().status).toBe(409);
    expect(createRefund).not.toHaveBeenCalled();
    expect(rows).toEqual([]);
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

  it("frees the amount of a refund Stripe did not make and says it can be sent again; the reason stays audited", async () => {
    const { service, txPublish, rows, createRefund } = setup({ refundStatus: "failed" });
    const result = await service.refundDelivery(input());
    expect(result._unsafeUnwrapErr().status).toBe(502);
    expect(result._unsafeUnwrapErr().message).toContain("you can send the refund again");
    expect(txPublish).toHaveBeenCalledTimes(1);
    expect(rows[0]).toMatchObject({ status: "failed", stripeRefundId: "re_courier" });

    // The retry is a new request with a new idempotency key, and goes through.
    const retry = await service.refundDelivery(input({ actorUserId: "staff-1" }));
    expect(retry._unsafeUnwrapErr().status).toBe(502); // the same stub still fails it
    expect(
      createRefund.mock.calls.map((c) => (c[0] as { deliveryRefundId: string }).deliveryRefundId),
    ).toEqual(["req-1", "req-2"]);
  });

  it("frees the amount when Stripe refuses the request outright", async () => {
    const refused = new Stripe.errors.StripeInvalidRequestError({
      type: "invalid_request_error",
      message: "Refund amount is greater than unrefunded amount on charge",
    });
    const { service, rows } = setup({ refundThrows: refused });
    const result = await service.refundDelivery(input());
    expect(result._unsafeUnwrapErr().message).toContain("Nothing was refunded");
    expect(rows[0]?.status).toBe("failed");
  });

  it("keeps the amount held when Stripe does not answer, and says what to check", async () => {
    const { service, rows } = setup({ refundThrows: new Error("socket hang up") });
    const result = await service.refundDelivery(input());
    expect(result._unsafeUnwrapErr().status).toBe(502);
    expect(result._unsafeUnwrapErr().message).toContain("Check the payment's refunds in Stripe");
    expect(rows[0]?.status).toBe("pending");
  });
});
