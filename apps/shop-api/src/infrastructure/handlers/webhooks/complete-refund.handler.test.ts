import type { Database } from "@auction/db";
import { describe, expect, it, vi } from "vitest";
import {
  allocateOrderLevelRefundsToLines,
  computeEffectiveLineRefundedPence,
} from "../../refund-settlement.js";
import { completeRefundFromWebhook } from "./complete-refund.handler.js";

const publishedEvents = vi.hoisted(() => [] as Array<{ eventType: string; payload: unknown }>);

vi.mock("../../shop-domain-event-publisher.js", () => ({
  createShopDomainEventPublisher: () => ({
    insertInTransaction: vi.fn(
      async (_tx: unknown, event: { eventType: string; payload: unknown }) => {
        publishedEvents.push({ eventType: event.eventType, payload: event.payload });
      },
    ),
  }),
}));

type SelectRows = unknown[];

function createSelectMock(queue: SelectRows[]) {
  return vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => {
        const rows = queue.shift() ?? [];
        return Object.assign(Promise.resolve(rows), {
          limit: vi.fn(async () => rows),
        });
      }),
    })),
  }));
}

function createTxMock(options: {
  selectQueue: SelectRows[];
  orderStatusUpdates: Array<{ status: string }>;
  refundInserts: unknown[];
}) {
  const update = vi.fn(() => ({
    set: vi.fn((data: { status?: string }) => ({
      where: vi.fn(async () => {
        if (data.status !== undefined) {
          options.orderStatusUpdates.push({ status: data.status });
        }
      }),
    })),
  }));

  let insertCalls = 0;
  const insert = vi.fn(() => ({
    values: vi.fn((row: unknown) => {
      insertCalls += 1;
      if (insertCalls > 1) {
        options.refundInserts.push(row);
      }
      return {
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn(async () =>
            insertCalls === 1
              ? [{ eventId: "evt_claim" }]
              : [{ id: "new-refund-id", status: "succeeded", stripeRefundId: "re_new" }],
          ),
        })),
      };
    }),
  }));

  return {
    select: createSelectMock([...options.selectQueue]),
    insert,
    update,
  };
}

describe("computeEffectiveLineRefundedPence", () => {
  it("splits order-level partial refund across lines by unit price", () => {
    const lines = [
      { id: "line-a", unitPricePence: 6000 },
      { id: "line-b", unitPricePence: 4000 },
    ];
    const effective = computeEffectiveLineRefundedPence(lines, [
      { amountPence: 5000, orderLineId: null },
    ]);
    expect(effective.get("line-a")).toBe(3000);
    expect(effective.get("line-b")).toBe(2000);
  });

  it("does not apply full order-level amount to every line", () => {
    const lines = [
      { id: "line-a", unitPricePence: 6000 },
      { id: "line-b", unitPricePence: 4000 },
    ];
    const share = allocateOrderLevelRefundsToLines(5000, lines);
    expect(share.get("line-a")).toBe(3000);
    expect(share.get("line-b")).toBe(2000);
    expect([...share.values()].reduce((a, b) => a + b, 0)).toBe(5000);
  });
});

describe("completeRefundFromWebhook", () => {
  it("links webhook refund via metadata shopRefundId when stripeRefundId is new", async () => {
    const orderStatusUpdates: Array<{ status: string }> = [];
    const refundInserts: unknown[] = [];
    const existingRefundId = "11111111-1111-4111-8111-111111111111";

    const tx = createTxMock({
      selectQueue: [
        [],
        [{ id: existingRefundId, status: "pending" }],
        [{ amountPence: 500, status: "succeeded" }],
        [],
        [{ amountPence: 500, status: "succeeded" }],
      ],
      orderStatusUpdates,
      refundInserts,
    });

    const db = {
      select: createSelectMock([
        [{ id: "22222222-2222-4222-8222-222222222222", totalPence: 5000 }],
      ]),
      transaction: vi.fn(async (fn: (inner: typeof tx) => Promise<unknown>) => fn(tx)),
    } as unknown as Database;

    const outcome = await completeRefundFromWebhook(
      db,
      {
        eventId: "evt_meta_match",
        stripeRefundId: "re_new_stripe",
        paymentIntentId: "pi_shop",
        amountPence: 500,
        status: "succeeded",
        shopRefundId: existingRefundId,
        source: "refund.created",
      },
      "off",
    );

    expect(outcome).toBe("processed");
    expect(refundInserts).toHaveLength(0);
    expect(orderStatusUpdates.some((row) => row.status === "partially_refunded")).toBe(true);
  });

  it("derives order refund status from succeeded refunds only", async () => {
    const orderStatusUpdates: Array<{ status: string }> = [];
    const refundInserts: unknown[] = [];

    const tx = createTxMock({
      selectQueue: [
        [{ id: "ref-stripe", status: "pending" }],
        [
          { amountPence: 800, status: "pending" },
          { amountPence: 200, status: "succeeded" },
        ],
        [],
        [
          { amountPence: 800, status: "pending" },
          { amountPence: 200, status: "succeeded" },
        ],
      ],
      orderStatusUpdates,
      refundInserts,
    });

    const db = {
      select: createSelectMock([[{ id: "order-1", totalPence: 1000 }]]),
      transaction: vi.fn(async (fn: (inner: typeof tx) => Promise<unknown>) => fn(tx)),
    } as unknown as Database;

    await completeRefundFromWebhook(
      db,
      {
        eventId: "evt_succeeded_only",
        stripeRefundId: "re_1",
        paymentIntentId: "pi_shop",
        amountPence: 200,
        status: "succeeded",
        source: "refund.updated",
      },
      "off",
    );

    expect(orderStatusUpdates.map((row) => row.status)).toContain("partially_refunded");
    expect(orderStatusUpdates.map((row) => row.status)).not.toContain("refunded");
  });

  it("returns ignored when payment intent does not map to a shop order", async () => {
    const db = {
      select: createSelectMock([[]]),
      transaction: vi.fn(),
    } as unknown as Database;

    const outcome = await completeRefundFromWebhook(
      db,
      {
        eventId: "evt_foreign",
        stripeRefundId: "re_foreign",
        paymentIntentId: "pi_foreign",
        amountPence: 100,
        status: "succeeded",
        source: "refund.created",
      },
      "off",
    );

    expect(outcome).toBe("ignored");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("ignores shopRefundId metadata when refund belongs to another order", async () => {
    const refundInserts: unknown[] = [];
    const tx = createTxMock({
      selectQueue: [
        [],
        [],
        [{ amountPence: 100, status: "succeeded" }],
        [],
        [{ amountPence: 100, status: "succeeded" }],
      ],
      orderStatusUpdates: [],
      refundInserts,
    });

    const db = {
      select: createSelectMock([[{ id: "order-1", totalPence: 1000 }]]),
      transaction: vi.fn(async (fn: (inner: typeof tx) => Promise<unknown>) => fn(tx)),
    } as unknown as Database;

    await completeRefundFromWebhook(
      db,
      {
        eventId: "evt_wrong_order_meta",
        stripeRefundId: "re_new",
        paymentIntentId: "pi_shop",
        amountPence: 100,
        status: "succeeded",
        shopRefundId: "99999999-9999-4999-8999-999999999999",
        source: "refund.created",
      },
      "off",
    );

    expect(refundInserts.length).toBeGreaterThan(0);
  });
});

describe("completeRefundFromWebhook, a refund Stripe reports failed after it succeeded (#1380 F2)", () => {
  const refundId = "11111111-1111-4111-8111-111111111111";
  const orderId = "22222222-2222-4222-8222-222222222222";

  async function failedAfter(row: Record<string, unknown>) {
    publishedEvents.length = 0;
    const sets: Array<Record<string, unknown>> = [];
    const tx = {
      select: createSelectMock([[{ id: refundId, stripeRefundId: "re_1", ...row }]]),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn(async () => [{ eventId: "evt_claim" }]),
          })),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((data: Record<string, unknown>) => ({
          where: vi.fn(async () => {
            sets.push(data);
          }),
        })),
      })),
    };
    const db = {
      select: createSelectMock([
        [{ id: orderId, totalPence: 5000, reference: "LAX-1", identitySubjectId: "s" }],
      ]),
      transaction: vi.fn(async (fn: (inner: typeof tx) => Promise<unknown>) => fn(tx)),
    } as unknown as Database;
    const outcome = await completeRefundFromWebhook(
      db,
      {
        eventId: "evt_failed_later",
        stripeRefundId: "re_1",
        paymentIntentId: "pi_shop",
        amountPence: 500,
        status: "failed",
        source: "refund.failed",
      },
      "enforce",
    );
    return { outcome, sets };
  }

  it("records the reversal once, keeps the status, and writes shop.refund.reversed", async () => {
    const { outcome, sets } = await failedAfter({
      status: "succeeded",
      settledOutsideAt: null,
      reversedAt: null,
    });
    expect(outcome).toBe("processed");
    expect(sets).toHaveLength(1);
    expect(Object.keys(sets[0] ?? {})).toEqual(["reversedAt"]);
    expect(publishedEvents).toEqual([
      {
        eventType: "shop.refund.reversed",
        payload: { schemaVersion: 1, refundId, orderId },
      },
    ]);
  });

  it.each([
    ["already reversed", { status: "succeeded", settledOutsideAt: null, reversedAt: new Date() }],
    [
      "settled outside Stripe",
      { status: "succeeded", settledOutsideAt: new Date(), reversedAt: null },
    ],
    ["that never succeeded", { status: "pending", settledOutsideAt: null, reversedAt: null }],
  ])("writes no reversal for a refund %s", async (_, row) => {
    const { sets } = await failedAfter(row);
    expect(sets.some((data) => "reversedAt" in data)).toBe(false);
    expect(publishedEvents.map((e) => e.eventType)).not.toContain("shop.refund.reversed");
  });
});
