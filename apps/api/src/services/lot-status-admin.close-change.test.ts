import type { ILotRepository, ISaleRepository } from "@auction/persistence/interfaces";
import type { Lot, Sale } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { LotStatusAdminService } from "./lot-status-admin.service.js";

const NOW = new Date("2026-11-15T17:42:00.000Z");
const CLOSE = new Date("2026-11-15T18:00:00.000Z");

function service(status: Lot["status"]) {
  let row = { id: "lot-1", saleId: "sale-1", status, endTime: CLOSE, winnerId: null } as Lot;
  const lotRepo = {
    findById: vi.fn(async () => row),
    updateStatus: vi.fn(async (_id: string, next: Lot["status"]) => {
      row = { ...row, status: next };
    }),
  } as unknown as ILotRepository;
  const saleRepo = {
    findById: vi.fn(async () => ({ id: "sale-1" }) as Sale),
  } as unknown as ISaleRepository;
  const notifier = { notifyLotExtended: vi.fn().mockResolvedValue(undefined) };
  const jobs = {
    cancelLotJobs: vi.fn(),
    scheduleLot: vi.fn(),
    rescheduleEnd: vi.fn(),
    cancelLotEndJob: vi.fn(),
  };
  const svc = new LotStatusAdminService(
    saleRepo,
    lotRepo,
    jobs,
    null,
    null,
    null,
    false,
    null,
    notifier,
    () => NOW,
  );
  return { svc, notifier };
}

describe("LotStatusAdminService close changes", () => {
  it("staff ending a live lot tell open pages it closes now, not at its old close", async () => {
    const { svc, notifier } = service("active");
    const result = await svc.setLotStatus("staff", "sale-1", "lot-1", "ended", undefined, [
      "administrator",
    ]);
    expect(result.isOk()).toBe(true);
    expect(notifier.notifyLotExtended).toHaveBeenCalledTimes(1);
    const [published, closesAt] = notifier.notifyLotExtended.mock.calls[0] as [Lot, Date];
    expect(published.id).toBe("lot-1");
    expect(closesAt).toEqual(NOW);
  });

  it("a refused change publishes nothing", async () => {
    const { svc, notifier } = service("scheduled");
    const result = await svc.setLotStatus("staff", "sale-1", "lot-1", "ended", undefined, [
      "administrator",
    ]);
    expect(result.isErr() && result.error.message).toMatch(/Cannot move lot from scheduled/);
    expect(notifier.notifyLotExtended).not.toHaveBeenCalled();
  });
});
