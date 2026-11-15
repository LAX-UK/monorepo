import type { Lot } from "@auction/types";
import { lotLiveDeliveries, parseLotRealtimeRedisMessage } from "@auction/validators";
import { describe, expect, it, vi } from "vitest";
import { RedisNotificationSender } from "../../infrastructure/redis-notification.sender.js";
import { announceLotCloseChange } from "./lot-close-change.js";

const SIX = new Date("2026-11-15T18:00:00.000Z");
const TEN_TO = new Date("2026-11-15T17:50:00.000Z");

function lot(over: Partial<Lot> = {}): Lot {
  return { id: "lot-1", status: "active", endTime: SIX, ...over } as Lot;
}

describe("announceLotCloseChange", () => {
  it("publishes the new close on the lot's channel as the close-time event open pages follow", async () => {
    const publish = vi.fn().mockResolvedValue(1);
    const sender = new RedisNotificationSender({ publish } as never);
    await announceLotCloseChange(sender, {
      before: lot(),
      lot: lot({ endTime: TEN_TO }),
      closesAt: TEN_TO,
    });
    expect(publish).toHaveBeenCalledTimes(1);
    const [channel, raw] = publish.mock.calls[0] as [string, string];
    expect(channel).toBe("lot:lot-1:events");
    const message = parseLotRealtimeRedisMessage(JSON.parse(raw));
    if (!message) throw new Error("expected a lot message");
    const [delivery] = lotLiveDeliveries(message, new Date("2026-11-15T17:40:01.000Z"));
    expect(delivery).toMatchObject({
      audience: "lot",
      event: "lot.extended",
      payload: {
        lotId: "lot-1",
        extendedUntil: "2026-11-15T17:50:00.000Z",
        serverNow: "2026-11-15T17:40:01.000Z",
      },
    });
    expect(Date.parse((delivery?.payload as { changedAt: string }).changedAt)).not.toBeNaN();
  });

  it("publishes nothing when the close did not move", async () => {
    const notifier = { notifyLotExtended: vi.fn() };
    await announceLotCloseChange(notifier, { before: lot(), lot: lot(), closesAt: SIX });
    expect(notifier.notifyLotExtended).not.toHaveBeenCalled();
  });

  it("publishes nothing for a lot no public page counts down (draft or already ended)", async () => {
    const notifier = { notifyLotExtended: vi.fn() };
    for (const status of ["draft", "ended", "cancelled"] as const) {
      await announceLotCloseChange(notifier, {
        before: lot({ status }),
        lot: lot({ status, endTime: TEN_TO }),
        closesAt: TEN_TO,
      });
    }
    expect(notifier.notifyLotExtended).not.toHaveBeenCalled();
  });

  it("keeps the saved change when publishing fails", async () => {
    const notifier = { notifyLotExtended: vi.fn().mockRejectedValue(new Error("redis down")) };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      announceLotCloseChange(notifier, { before: lot(), lot: lot(), closesAt: TEN_TO }),
    ).resolves.toBeUndefined();
    expect(notifier.notifyLotExtended).toHaveBeenCalledWith(lot(), TEN_TO);
    log.mockRestore();
  });
});

describe("updateLot close changes", () => {
  async function edit(status: Lot["status"], patch: Partial<Lot>) {
    const { updateLot } = await import("./lot-update.js");
    const start = new Date(Date.now() + 86_400_000);
    const end = new Date(Date.now() + 2 * 86_400_000);
    const row = { id: "lot-1", saleId: null, status, startTime: start, endTime: end } as Lot;
    const notifier = { notifyLotExtended: vi.fn().mockResolvedValue(undefined) };
    const deps = {
      lotRepo: {
        findById: vi.fn(async () => row),
        update: vi.fn(async (_id: string, p: Partial<Lot>) => ({ ...row, ...p })),
      },
      saleRepo: null,
      jobScheduler: null,
      lotCloseNotifier: notifier,
      englishOnlyAuctions: false,
    } as never;
    const result = await updateLot(deps, "staff", "lot-1", patch as never, ["administrator"]);
    return { result, notifier, end };
  }

  it("staff moving an upcoming lot's close publish the new close", async () => {
    const newEnd = new Date(Date.now() + 36 * 3_600_000);
    const { result, notifier } = await edit("scheduled", { endTime: newEnd });
    expect(result.isOk()).toBe(true);
    expect(notifier.notifyLotExtended).toHaveBeenCalledTimes(1);
    expect(notifier.notifyLotExtended.mock.calls[0]?.[1]).toEqual(newEnd);
  });

  it("an edit that leaves the close alone publishes nothing", async () => {
    const { result, notifier } = await edit("scheduled", { title: "Estuary" });
    expect(result.isOk()).toBe(true);
    expect(notifier.notifyLotExtended).not.toHaveBeenCalled();
  });
});
