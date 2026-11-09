import { describe, expect, it, vi } from "vitest";
import {
  completeShopCheckoutSession,
  failShopCheckoutSession,
} from "./drizzle-payment-event.processor.js";

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
        where: vi.fn(() => ({
          for: vi.fn(() => ({
            limit: vi.fn(async () => (options.order ? [options.order] : [])),
          })),
        })),
      })),
    })),
  };

  return {
    inserted,
    transaction: vi.fn(async (fn: (inner: typeof tx) => Promise<unknown>) => fn(tx)),
  };
}

/** The finance task store: serialises one piece of money, and says whether it is already known. */
function knownMoney(exists: boolean) {
  return { lockKey: vi.fn(async () => undefined), exists: vi.fn(async () => exists) };
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

  it("rejects amount mismatches as non-retryable", async () => {
    const db = createDbMock({
      claim: true,
      order: {
        id: "order-1",
        totalPence: 1000,
        status: "pending_payment",
        identitySubjectId: "sub-1",
      },
    });

    await expect(
      completeShopCheckoutSession(db as never, {
        eventId: "evt-1",
        orderId: "order-1",
        sessionId: "cs_test",
        amountTotalPence: 999,
        paidAt: new Date(),
      }),
    ).rejects.toMatchObject({
      message: "amount_mismatch",
      retryable: false,
    });
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

    it("keys the task by the Stripe event when no PaymentIntent was reported", async () => {
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
      expect(task.payload.dedupeKey).toBe("shop_order_paid_after_close:evt-1");
    });

    it("takes the money's lock and opens no second task when the same PaymentIntent is already known", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const db = createDbMock({ claim: true, order: closedOrder });
      const money = knownMoney(true);
      await expect(
        completeShopCheckoutSession(db as never, paid, { unappliedMoney: money }),
      ).resolves.toBe("terminal_acknowledged");
      expect(money.lockKey).toHaveBeenCalledWith(
        expect.anything(),
        "shop_order_paid_after_close:pi_123",
      );
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
      const db = createDbMock({ claim: true, order: { ...closedOrder, status: "paid" } });
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
