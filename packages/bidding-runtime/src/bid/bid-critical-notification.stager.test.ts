import type { Database } from "@auction/db";
import type { IBidRepository } from "@auction/persistence/interfaces";
import type { Bid, Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { NotificationFactory } from "../notification-factory.js";
import type { INotificationOutboxService } from "../ports.js";
import { BidCriticalNotificationStager } from "./bid-critical-notification.stager.js";

const LOT_ID = "9b7d0a52-1f43-4b7a-8a55-0c2f6e1d3a90";
const PREV_WINNER = "4a1f0c2e-5b6d-4e7f-8a9b-0c1d2e3f4a5b";
const NEW_BIDDER = "6c2d1e3f-7a8b-4c9d-8e0f-1a2b3c4d5e6f";

const lotRow = { id: LOT_ID, title: "Blue Vase", currentPrice: "900.00", saleId: null } as Lot;
const created = {
  id: "8e4f3a5b-9c0d-4e1f-8a2b-3c4d5e6f7a8b",
  amount: "1000.00",
  placedByUserId: NEW_BIDDER,
} as Bid;

function run(endedEarly: boolean) {
  const stageDispatch = vi.fn<INotificationOutboxService["stageDispatch"]>(async () => undefined);
  const stager = new BidCriticalNotificationStager(
    { stageDispatch },
    new NotificationFactory(),
    null,
  );
  return {
    stageDispatch,
    done: stager.stageInTransaction({
      lotId: LOT_ID,
      lotRow,
      created,
      prevWinnerId: PREV_WINNER,
      endedEarly,
      bids: { listDistinctBidderIds: async () => [PREV_WINNER, NEW_BIDDER] } as IBidRepository,
      tx: {} as Database,
    }),
  };
}

describe("BidCriticalNotificationStager amounts", () => {
  it("stages the outbid notice with the new high bid as structured metadata", async () => {
    const { stageDispatch, done } = run(false);
    await done;
    const outbid = stageDispatch.mock.calls[0]?.[0];
    expect(outbid?.userId).toBe(PREV_WINNER);
    expect(outbid?.payload.meta?.bidAmount).toBe("1000.00");
  });

  it("stages the won notice with the winning bid when the lot closes early", async () => {
    const { stageDispatch, done } = run(true);
    await done;
    const won = stageDispatch.mock.calls
      .map(([input]) => input)
      .find((input) => input.payload.type === "lot_won");
    expect(won?.userId).toBe(NEW_BIDDER);
    expect(won?.payload.meta?.bidAmount).toBe("1000.00");
  });
});
