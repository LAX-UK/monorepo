import type { Database } from "@auction/db";
import { describe, expect, it, vi } from "vitest";
import type { WorkerLotLifecycleEventRecorder } from "../lifecycle/worker-lifecycle-event-recorder.js";
import { WorkerBidLotLifecycleRecording } from "./worker-bid-lot-lifecycle-recording.js";

describe("WorkerBidLotLifecycleRecording", () => {
  it("records lot.ended on early close", async () => {
    const record = vi.fn().mockResolvedValue(undefined);
    const recorder = { record } as unknown as WorkerLotLifecycleEventRecorder;
    const recording = new WorkerBidLotLifecycleRecording(recorder);
    const tx = {} as Database;

    await recording.recordEnded(tx, {
      lot: {
        id: "lot-1",
        status: "ended",
        saleId: "sale-1",
        sellerLegalEntityId: "le-seller",
      },
      payload: {
        outcome: "sold",
        winnerId: "user-winner",
        saleId: "sale-1",
        trigger: "early_close",
        hammerPrice: "500.00",
      },
      actorUserId: "user-winner",
    });

    expect(record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        lotId: "lot-1",
        eventType: "lot.ended",
        snapshotPatch: expect.objectContaining({
          currentStatus: "ended",
          lastEventType: "lot.ended",
          lastSaleOutcome: "sold",
        }),
      }),
    );
  });
});
