import { describe, expect, it, vi } from "vitest";
import {
  completeShopCheckoutSession,
  failShopCheckoutSession,
} from "./drizzle-payment-event.processor.js";

type MockOrder = {
  id: string;
  totalPence: number;
  status: string;
  identitySubjectId: string;
};

function createDbMock(options: { claim: boolean; order: MockOrder | null }) {
  const tx = {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn(async () => (options.claim ? [{ eventId: "evt-1" }] : [])),
        })),
      })),
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
    transaction: vi.fn(async (fn: (inner: typeof tx) => Promise<unknown>) => fn(tx)),
  };
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
        amountTotalPence: 999,
        paidAt: new Date(),
      }),
    ).rejects.toMatchObject({
      message: "amount_mismatch",
      retryable: false,
    });
  });

  it("rejects invalid order status as retryable", async () => {
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
      completeShopCheckoutSession(db as never, {
        eventId: "evt-1",
        orderId: "order-1",
        amountTotalPence: 1000,
        paidAt: new Date(),
      }),
    ).rejects.toMatchObject({
      message: "payment_state_invalid",
      retryable: true,
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
      }),
    ).resolves.toBe("processed");
  });
});
