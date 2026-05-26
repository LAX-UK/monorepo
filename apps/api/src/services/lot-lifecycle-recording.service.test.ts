import type { Database } from "@auction/db";
import { describe, expect, it, vi } from "vitest";
import type { LotLifecycleEventRecorder } from "./lot-lifecycle-event-recorder.js";
import { LotLifecycleRecording } from "./lot-lifecycle-recording.service.js";

describe("LotLifecycleRecording.recordDetached", () => {
  it("clears lastSaleId and decrements attachedCount in snapshot patch", async () => {
    const record = vi.fn();
    const recorder = { record } as unknown as LotLifecycleEventRecorder;
    const svc = new LotLifecycleRecording(recorder);
    const tx = {} as Database;

    await svc.recordDetached(
      tx,
      {
        id: "lot-1",
        status: "draft",
        saleId: null,
        sellerLegalEntityId: "seller-1",
      },
      "sale-1",
    );

    expect(record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        eventType: "lot.detached_from_sale",
        snapshotPatch: expect.objectContaining({
          lastSaleId: null,
          attachedCountDelta: -1,
        }),
      }),
    );
  });
});

describe("LotLifecycleRecording.recordReturnedToInventory", () => {
  it("preserves lastSaleId and decrements attachedCount when lot had a sale", async () => {
    const record = vi.fn();
    const recorder = { record } as unknown as LotLifecycleEventRecorder;
    const svc = new LotLifecycleRecording(recorder);
    const tx = {} as Database;

    await svc.recordReturnedToInventory(
      tx,
      { id: "lot-1", sellerLegalEntityId: "seller-1" },
      {
        fromStatus: "ended",
        lastSaleId: "sale-1",
        reason: "Staff returned lot to inventory",
      },
      "staff-1",
    );

    expect(record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        eventType: "lot.returned_to_inventory",
        snapshotPatch: expect.objectContaining({
          lastSaleId: "sale-1",
          attachedCountDelta: -1,
        }),
      }),
    );
  });
});
