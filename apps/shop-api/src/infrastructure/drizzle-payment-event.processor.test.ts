import { describe, expect, it, vi } from "vitest";

// Ending a quote and putting the basket back are tested on their own; here only that they are asked.
vi.mock("./shop-delivery-quote-close.js", () => ({ closeDeliveryQuoteForOrder: vi.fn() }));
vi.mock("./shop-restore-basket-from-order.js", () => ({
  restoreBasketLinesFromOrder: vi.fn(),
}));

import {
  SHOP_CHECKOUT_SETTLE_FAILED,
  completeShopCheckoutSession,
  deferOrSettleCheckout,
  failShopCheckoutSession,
} from "./drizzle-payment-event.processor.js";
vi.mock("./shop-checkout-hold.js", () => ({
  DEFERRALS_BEFORE_OPS_ALERT: 3,
  deferCheckoutHold: vi.fn(async () => ({ kind: "at_cap" })),
}));

import { restoreBasketLinesFromOrder } from "./shop-restore-basket-from-order.js";

type MockOrder = {
  id: string;
  reference?: string;
  totalPence: number;
  status: string;
  identitySubjectId: string;
  stripeCheckoutSessionId?: string | null;
};

function createDbMock(options: { claim: boolean; order: MockOrder | null }) {
  const inserted: unknown[] = [];
  const updated: unknown[] = [];
  const tx = {
    insert: vi.fn(() => ({
      values: vi.fn((row: unknown) => {
        inserted.push(row);
        return {
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn(async () => (options.claim ? [{ eventId: "evt-1" }] : [])),
          })),
        };
      }),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        // Locked and read as one row, or awaited directly as an order with no lines.
        where: vi.fn(() =>
          Object.assign(Promise.resolve([]), {
            for: vi.fn(() => ({
              limit: vi.fn(async () => (options.order ? [options.order] : [])),
            })),
          }),
        ),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((row: unknown) => {
        updated.push(row);
        return { where: vi.fn(async () => []) };
      }),
    })),
  };

  return {
    inserted,
    updated,
    transaction: vi.fn(async (fn: (inner: typeof tx) => Promise<unknown>) => fn(tx)),
  };
}

/** The finance task store: serialises one piece of money, and says whether it is already known. */
function knownMoney(exists: boolean) {
  return { lockKey: vi.fn(async () => undefined), existsForShopPayment: vi.fn(async () => exists) };
}

describe("completeShopCheckoutSession", () => {
  it("returns duplicate when the payment event was already processed", async () => {
    const db = createDbMock({
      claim: false,
      order: {
        id: "order-1",
        totalPence: 1000,
        status: "pending_payment",
        identitySubjectId: "sub-1",
      },
    });

    await expect(
      completeShopCheckoutSession(db as never, {
        eventId: "evt-dup",
        orderId: "order-1",
        sessionId: "cs_test",
        amountTotalPence: 1000,
        paidAt: new Date(),
      }),
    ).resolves.toBe("duplicate");
  });

  it("acknowledges paid webhook for terminal order status without mutating", async () => {
    const db = createDbMock({
      claim: true,
      order: {
        id: "order-1",
        totalPence: 1000,
        status: "expired",
        identitySubjectId: "sub-1",
      },
    });

    await expect(
      completeShopCheckoutSession(
        db as never,
        {
          eventId: "evt-1",
          orderId: "order-1",
          sessionId: "cs_test",
          amountTotalPence: 1000,
          paidAt: new Date(),
        },
        { unappliedMoney: knownMoney(false) },
      ),
    ).resolves.toBe("terminal_acknowledged");
  });

  describe("money taken for an order that had closed", () => {
    const closedOrder = {
      id: "order-1",
      reference: "LAX-S-10482",
      totalPence: 1000,
      status: "expired",
      identitySubjectId: "sub-1",
    };
    const paid = {
      eventId: "evt-1",
      orderId: "order-1",
      sessionId: "cs_test",
      amountTotalPence: 1000,
      paidAt: new Date(),
      paymentIntentId: "pi_123",
    };

    it("opens a finance task with the order, session, PaymentIntent and amount, with no ops email set", async () => {
      const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const db = createDbMock({ claim: true, order: closedOrder });
      await expect(
        completeShopCheckoutSession(db as never, paid, { unappliedMoney: knownMoney(false) }),
      ).resolves.toBe("terminal_acknowledged");
      const task = db.inserted.find(
        (row) => (row as { eventType?: string }).eventType === "payment.unapplied_money_received",
      ) as { aggregateId: string; producer: string; payload: Record<string, unknown> };
      expect(task.producer).toBe("shop-api");
      expect(task.payload).toMatchObject({
        reason: "shop_order_paid_after_close",
        shopOrderId: "order-1",
        shopOrderReference: "LAX-S-10482",
        shopCheckoutSessionId: "cs_test",
        stripePaymentIntentId: "pi_123",
        amountCents: 1000,
        currency: "GBP",
        dedupeKey: "shop_order_paid_after_close:pi_123",
      });
      const line = log.mock.calls
        .map(([text]) => String(text))
        .find((text) => text.includes("shop_paid_terminal_order"));
      expect(JSON.parse(line ?? "{}")).toMatchObject({
        msg: "shop_paid_terminal_order",
        orderId: "order-1",
        orderStatus: "expired",
        paymentIntentId: "pi_123",
        amountPence: 1000,
      });
      log.mockRestore();
    });

    it("still sends the ops email as an extra when one is set", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const queueCheckoutOpsAlert = vi.fn(async () => undefined);
      const db = createDbMock({ claim: true, order: closedOrder });
      await completeShopCheckoutSession(db as never, paid, {
        opsAlertEmail: "ops@example.test",
        notifications: { queueCheckoutOpsAlert } as never,
        unappliedMoney: knownMoney(false),
      });
      expect(queueCheckoutOpsAlert).toHaveBeenCalledOnce();
      expect(
        db.inserted.some(
          (row) => (row as { eventType?: string }).eventType === "payment.unapplied_money_received",
        ),
      ).toBe(true);
    });

    it("keys the task by the payment session when no PaymentIntent was reported", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const db = createDbMock({ claim: true, order: closedOrder });
      await completeShopCheckoutSession(
        db as never,
        { ...paid, paymentIntentId: null },
        { unappliedMoney: knownMoney(false) },
      );
      const task = db.inserted.find(
        (row) => (row as { eventType?: string }).eventType === "payment.unapplied_money_received",
      ) as { payload: { dedupeKey: string } };
      expect(task.payload.dedupeKey).toBe("shop_order_paid_after_close:cs_test");
    });

    it("takes the money's lock and opens no second task when the same PaymentIntent is already known", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const db = createDbMock({ claim: true, order: closedOrder });
      const money = knownMoney(true);
      await expect(
        completeShopCheckoutSession(db as never, paid, { unappliedMoney: money }),
      ).resolves.toBe("terminal_acknowledged");
      expect(money.lockKey).toHaveBeenCalledWith(expect.anything(), "shop-session:cs_test");
      expect(
        db.inserted.some(
          (row) => (row as { eventType?: string }).eventType === "payment.unapplied_money_received",
        ),
      ).toBe(false);
    });

    it("shares its audit trail with the event that closes the task", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const db = createDbMock({ claim: true, order: closedOrder });
      await completeShopCheckoutSession(db as never, paid, { unappliedMoney: knownMoney(false) });
      const task = db.inserted.find(
        (row) => (row as { eventType?: string }).eventType === "payment.unapplied_money_received",
      ) as { aggregateType: string; aggregateId: string };
      // The resolved event is recorded on the same aggregate: the key, for money with no payment.
      expect(task).toMatchObject({
        aggregateType: "payment_group",
        aggregateId: "shop_order_paid_after_close:pi_123",
      });
    });

    it("fails, so Stripe sends the event again, rather than drop money when no finance store is wired", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const db = createDbMock({ claim: true, order: closedOrder });
      await expect(completeShopCheckoutSession(db as never, paid)).rejects.toThrow(
        "unapplied_money_reader_not_configured",
      );
    });

    it("records nothing for an order that is still waiting or already paid", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const db = createDbMock({
        claim: true,
        order: { ...closedOrder, status: "paid", stripeCheckoutSessionId: "cs_test" },
      });
      await expect(completeShopCheckoutSession(db as never, paid)).resolves.toBe("processed");
      expect(
        db.inserted.some(
          (row) => (row as { eventType?: string }).eventType === "payment.unapplied_money_received",
        ),
      ).toBe(false);
    });
  });
});

describe("failShopCheckoutSession", () => {
  it("no-ops when the order is no longer pending payment", async () => {
    const db = createDbMock({
      claim: true,
      order: {
        id: "order-1",
        totalPence: 1000,
        status: "expired",
        identitySubjectId: "sub-1",
      },
    });

    await expect(
      failShopCheckoutSession(db as never, {
        eventId: "evt-fail",
        orderId: "order-1",
        sessionId: "cs_test",
      }),
    ).resolves.toBe("processed");
  });
});

describe("a payment that cannot be applied to its order is tracked, not dropped", () => {
  const order: MockOrder = {
    id: "order-1",
    reference: "LAX-S-10482",
    totalPence: 1000,
    status: "pending_payment",
    identitySubjectId: "sub-1",
    stripeCheckoutSessionId: "cs_test",
  };
  const paid = {
    eventId: "evt-1",
    orderId: "order-1",
    sessionId: "cs_test",
    amountTotalPence: 1000,
    paidAt: new Date(),
    paymentIntentId: "pi_123",
  };
  const task = (db: ReturnType<typeof createDbMock>) =>
    db.inserted.find(
      (row) => (row as { eventType?: string }).eventType === "payment.unapplied_money_received",
    ) as { payload: Record<string, unknown> } | undefined;
  const quiet = () => vi.spyOn(console, "error").mockImplementation(() => undefined);

  it("records the amount actually paid for the wrong amount, and acknowledges once it is recorded", async () => {
    quiet();
    const db = createDbMock({ claim: true, order });
    const outcome = await completeShopCheckoutSession(
      db as never,
      { ...paid, amountTotalPence: 999 },
      { unappliedMoney: knownMoney(false) },
    );
    expect(outcome).toBe("unapplied_recorded");
    expect(task(db)?.payload).toMatchObject({
      reason: "shop_order_amount_mismatch",
      shopOrderId: "order-1",
      shopOrderReference: "LAX-S-10482",
      shopCheckoutSessionId: "cs_test",
      stripePaymentIntentId: "pi_123",
      amountCents: 999,
      currency: "GBP",
      dedupeKey: "shop_order_amount_mismatch:pi_123",
    });
  });

  it("records a payment made in another session than the order's", async () => {
    quiet();
    const db = createDbMock({ claim: true, order });
    const outcome = await completeShopCheckoutSession(
      db as never,
      { ...paid, sessionId: "cs_other" },
      { unappliedMoney: knownMoney(false) },
    );
    expect(outcome).toBe("unapplied_recorded");
    expect(task(db)?.payload).toMatchObject({
      reason: "shop_order_session_mismatch",
      shopCheckoutSessionId: "cs_other",
      amountCents: 1000,
    });
  });

  it("records a second payment, in another session, for an order already paid", async () => {
    quiet();
    const db = createDbMock({ claim: true, order: { ...order, status: "paid" } });
    const outcome = await completeShopCheckoutSession(
      db as never,
      { ...paid, sessionId: "cs_second" },
      { unappliedMoney: knownMoney(false) },
    );
    expect(outcome).toBe("unapplied_recorded");
    expect(task(db)?.payload).toMatchObject({
      reason: "shop_order_paid_twice",
      shopCheckoutSessionId: "cs_second",
    });
  });

  it("treats the same session again on a paid order as nothing new", async () => {
    const db = createDbMock({ claim: true, order: { ...order, status: "paid" } });
    const money = knownMoney(false);
    await expect(
      completeShopCheckoutSession(db as never, paid, { unappliedMoney: money }),
    ).resolves.toBe("processed");
    expect(task(db)).toBeUndefined();
    expect(money.lockKey).not.toHaveBeenCalled();
  });

  it("records a payment on a closed order with the amount actually paid, even when it is not the total", async () => {
    quiet();
    const db = createDbMock({ claim: true, order: { ...order, status: "expired" } });
    const outcome = await completeShopCheckoutSession(
      db as never,
      { ...paid, amountTotalPence: 555 },
      { unappliedMoney: knownMoney(false) },
    );
    expect(outcome).toBe("terminal_acknowledged");
    expect(task(db)?.payload).toMatchObject({
      reason: "shop_order_paid_after_close",
      amountCents: 555,
    });
  });

  it("takes the lock and opens no second task when the same PaymentIntent is already tracked", async () => {
    quiet();
    const db = createDbMock({ claim: true, order });
    const money = knownMoney(true);
    const outcome = await completeShopCheckoutSession(
      db as never,
      { ...paid, amountTotalPence: 999 },
      { unappliedMoney: money },
    );
    expect(outcome).toBe("unapplied_recorded");
    expect(money.lockKey).toHaveBeenCalledWith(expect.anything(), "shop-session:cs_test");
    expect(task(db)).toBeUndefined();
  });

  it("answers a replay of the same event as a duplicate, once it was tracked", async () => {
    quiet();
    // The first attempt applies and fails; the recording transaction then finds the claim taken.
    const db = createDbMock({ claim: true, order });
    const first = await completeShopCheckoutSession(
      db as never,
      { ...paid, amountTotalPence: 999 },
      { unappliedMoney: knownMoney(false) },
    );
    expect(first).toBe("unapplied_recorded");
    const replay = createDbMock({ claim: false, order });
    await expect(
      completeShopCheckoutSession(
        replay as never,
        { ...paid, amountTotalPence: 999 },
        { unappliedMoney: knownMoney(false) },
      ),
    ).resolves.toBe("duplicate");
  });

  it("sends the ops email as an extra, naming the failure", async () => {
    quiet();
    const queueCheckoutOpsAlert = vi.fn(async () => undefined);
    const db = createDbMock({ claim: true, order });
    await completeShopCheckoutSession(
      db as never,
      { ...paid, amountTotalPence: 999 },
      {
        unappliedMoney: knownMoney(false),
        opsAlertEmail: "ops@example.test",
        notifications: { queueCheckoutOpsAlert } as never,
      },
    );
    expect(queueCheckoutOpsAlert).toHaveBeenCalledOnce();
  });

  it("fails, so Stripe sends it again, when the money cannot be recorded", async () => {
    quiet();
    const db = createDbMock({ claim: true, order });
    const money = {
      lockKey: vi.fn(async () => {
        throw new Error("database down");
      }),
      existsForShopPayment: vi.fn(async () => false),
    };
    await expect(
      completeShopCheckoutSession(
        db as never,
        { ...paid, amountTotalPence: 999 },
        { unappliedMoney: money },
      ),
    ).rejects.toThrow("database down");
  });

  it("fails rather than drop the money when no finance store is wired", async () => {
    quiet();
    const db = createDbMock({ claim: true, order });
    await expect(
      completeShopCheckoutSession(db as never, { ...paid, amountTotalPence: 999 }),
    ).rejects.toThrow("unapplied_money_reader_not_configured");
  });

  it("closes an order paid on its own session but not applied, so nothing is left waiting for it", async () => {
    quiet();
    vi.mocked(restoreBasketLinesFromOrder).mockClear();
    const db = createDbMock({ claim: true, order });
    await completeShopCheckoutSession(
      db as never,
      { ...paid, amountTotalPence: 999 },
      { unappliedMoney: knownMoney(false) },
    );
    expect(db.updated).toContainEqual(expect.objectContaining({ status: "payment_failed" }));
    expect(restoreBasketLinesFromOrder).toHaveBeenCalled();
  });

  it("leaves an order waiting when the money came in another session, which does not spend its own", async () => {
    quiet();
    const db = createDbMock({ claim: true, order });
    await completeShopCheckoutSession(
      db as never,
      { ...paid, sessionId: "cs_other", amountTotalPence: 999 },
      { unappliedMoney: knownMoney(false) },
    );
    expect(db.updated).toEqual([]);
  });

  it("labels a stale session as the session, even when the amount is also wrong", async () => {
    quiet();
    const db = createDbMock({ claim: true, order });
    await completeShopCheckoutSession(
      db as never,
      { ...paid, sessionId: "cs_stale", amountTotalPence: 999 },
      { unappliedMoney: knownMoney(false) },
    );
    expect(task(db)?.payload).toMatchObject({ reason: "shop_order_session_mismatch" });
  });

  it("says in the ops alert that the order was closed", async () => {
    quiet();
    const queueCheckoutOpsAlert = vi.fn(async () => undefined);
    const db = createDbMock({ claim: true, order });
    await completeShopCheckoutSession(
      db as never,
      { ...paid, amountTotalPence: 999 },
      {
        unappliedMoney: knownMoney(false),
        opsAlertEmail: "ops@example.test",
        notifications: { queueCheckoutOpsAlert } as never,
      },
    );
    expect(queueCheckoutOpsAlert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ detail: expect.stringContaining("The order was closed") }),
    );
  });

  it("treats a paid order with no session, paid again in a Checkout session, as a second payment", async () => {
    quiet();
    const db = createDbMock({
      claim: true,
      order: { ...order, status: "paid", stripeCheckoutSessionId: null },
    });
    const outcome = await completeShopCheckoutSession(db as never, paid, {
      unappliedMoney: knownMoney(false),
    });
    expect(outcome).toBe("unapplied_recorded");
    expect(task(db)?.payload).toMatchObject({ reason: "shop_order_paid_twice" });
  });

  describe("an order already reached through payment", () => {
    it.each(["paid", "refunded", "partially_refunded"])(
      "treats the same session again on a %s order as nothing new",
      async (status) => {
        const db = createDbMock({ claim: true, order: { ...order, status } });
        await expect(
          completeShopCheckoutSession(db as never, paid, { unappliedMoney: knownMoney(false) }),
        ).resolves.toBe("processed");
        expect(task(db)).toBeUndefined();
      },
    );

    it("records a payment in another session on a refunded order as money for a closed order", async () => {
      quiet();
      const db = createDbMock({ claim: true, order: { ...order, status: "refunded" } });
      const outcome = await completeShopCheckoutSession(
        db as never,
        { ...paid, sessionId: "cs_other" },
        { unappliedMoney: knownMoney(false) },
      );
      expect(outcome).toBe("terminal_acknowledged");
      expect(task(db)?.payload).toMatchObject({ reason: "shop_order_paid_after_close" });
    });
  });

  describe("a payment for an order that does not exist", () => {
    it("in live mode records a finance task with no order, and acknowledges it", async () => {
      quiet();
      const db = createDbMock({ claim: true, order: null });
      const outcome = await completeShopCheckoutSession(
        db as never,
        { ...paid, livemode: true },
        { unappliedMoney: knownMoney(false) },
      );
      expect(outcome).toBe("unapplied_recorded");
      expect(task(db)?.payload).toMatchObject({
        reason: "shop_order_not_found",
        shopOrderId: null,
        shopCheckoutSessionId: "cs_test",
        stripePaymentIntentId: "pi_123",
        amountCents: 1000,
      });
    });

    it("in test mode logs it, tells ops and still answers with an error", async () => {
      const log = quiet();
      const queueCheckoutOpsAlert = vi.fn(async () => undefined);
      const db = createDbMock({ claim: true, order: null });
      await expect(
        completeShopCheckoutSession(db as never, paid, {
          unappliedMoney: knownMoney(false),
          opsAlertEmail: "ops@example.test",
          notifications: { queueCheckoutOpsAlert } as never,
        }),
      ).rejects.toMatchObject({ code: "payment_not_found", retryable: false });
      expect(task(db)).toBeUndefined();
      expect(queueCheckoutOpsAlert).toHaveBeenCalledOnce();
      expect(
        log.mock.calls.some(([text]) =>
          String(text).includes("shop_payment_unknown_order_test_mode"),
        ),
      ).toBe(true);
    });
  });
});

describe("an order past the ceiling that cannot be settled", () => {
  it("leaves the sweep with a structured log line and one plain ops alert, with no ops email needed for the log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const queueCheckoutOpsAlert = vi.fn(async () => undefined);
    const update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => []) })) }));
    const pendingOrder = [{ status: "pending_payment", sessionId: "cs_stuck" }];
    let transactions = 0;
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => pendingOrder) })) })),
      })),
      // The first transaction is the settle, which fails; the second takes the order out.
      transaction: vi.fn(async (fn: (tx: { update: typeof update }) => Promise<unknown>) => {
        transactions += 1;
        if (transactions === 1) throw new Error("finance store down");
        return fn({ update });
      }),
    };
    const gateway = {
      retrievePaidCheckout: vi.fn(async () => Promise.reject(new Error("stripe down"))),
    };

    const outcome = await deferOrSettleCheckout(
      db as never,
      "order-9",
      new Date(),
      {
        paymentGateway: gateway as never,
        opsAlertEmail: "ops@example.test",
        notifications: { queueCheckoutOpsAlert } as never,
      },
      { reason: "test", stripeShowsPaid: false },
    );

    expect(outcome).toBe("settle_failed");
    const line = log.mock.calls
      .map(([text]) => String(text))
      .find((text) => text.includes(SHOP_CHECKOUT_SETTLE_FAILED));
    expect(JSON.parse(line ?? "{}")).toEqual({
      msg: SHOP_CHECKOUT_SETTLE_FAILED,
      orderId: "order-9",
      sessionId: "cs_stuck",
      reason: "finance store down",
    });
    expect(queueCheckoutOpsAlert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        idempotencyKey: "checkout-settle-failed:order-9",
        detail: expect.stringContaining("Check the payment in Stripe and tell engineering"),
      }),
    );
    log.mockRestore();
  });
});
