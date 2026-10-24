import type { INotificationOutboxRepository } from "@auction/persistence/interfaces";
import type { Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { WorkerLotLifecycleNotifications } from "./worker-lot-lifecycle-notifications.js";

const LOT_ID = "9b7d0a52-1f43-4b7a-8a55-0c2f6e1d3a90";
const SELLER = "0d1e2f3a-4b5c-4d6e-8f7a-8b9c0d1e2f3a";
const WINNER = "6c2d1e3f-7a8b-4c9d-8e0f-1a2b3c4d5e6f";

function build() {
  type Staged = { userId: string; idempotencyKey: string; payload: unknown };
  const stage = vi.fn(async (_input: Staged, _tx?: unknown) => undefined);
  const notifications = new WorkerLotLifecycleNotifications({
    repoFactory: {} as never,
    watchlist: {} as never,
    redis: {} as never,
    notificationOutbox: { stage } as unknown as INotificationOutboxRepository,
    saleRepo: { findById: vi.fn(async () => null) } as never,
  });
  return { stage, notifications };
}

const lot = {
  id: LOT_ID,
  title: "Blue Vase",
  currentPrice: "500.00",
  saleId: null,
  sellerId: SELLER,
} as Lot;

const bidRepo = { listForLotSettlement: vi.fn(async () => []) };

describe("WorkerLotLifecycleNotifications lot close", () => {
  it("stages a sold notice for the consignor with the hammer price", async () => {
    const { stage, notifications } = build();
    await notifications.stageLotCloseNotificationsInTransaction({
      lot,
      winnerId: WINNER,
      bid: bidRepo,
      tx: {} as never,
    });
    const seller = stage.mock.calls
      .map(([input]) => input)
      .find((input) => input.userId === SELLER);
    expect(seller?.idempotencyKey).toBe(`lot_ended_seller:${LOT_ID}:${SELLER}`);
    expect(seller?.payload).toMatchObject({
      type: "lot_ended_seller",
      meta: { outcome: "sold", hammerPrice: "500.00" },
    });
  });

  it("stages an unsold notice when nobody won", async () => {
    const { stage, notifications } = build();
    await notifications.stageLotCloseNotificationsInTransaction({
      lot,
      winnerId: null,
      bid: bidRepo,
      tx: {} as never,
    });
    expect(stage).toHaveBeenCalledTimes(1);
    expect(stage.mock.calls[0]?.[0]).toMatchObject({
      userId: SELLER,
      payload: { type: "lot_ended_seller", meta: { outcome: "unsold" } },
    });
  });
});
