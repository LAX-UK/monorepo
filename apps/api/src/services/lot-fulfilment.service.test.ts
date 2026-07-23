import type { ILotFulfilmentRepository } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { LotFulfilmentService } from "./lot-fulfilment.service.js";

const lotId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const fulfilmentId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function makeFulfilmentRow(overrides: Partial<{ id: string; lotId: string; status: string }> = {}) {
  return {
    id: overrides.id ?? fulfilmentId,
    lotId: overrides.lotId ?? lotId,
    paymentId: "pay-1",
    status: overrides.status ?? "awaiting_release",
    fulfilmentMethod: null,
    shippingCarrier: null,
    trackingNumber: null,
    releaseApprovedByUserId: null,
    releaseApprovedAt: null,
    collectedAt: null,
    collectedBy: null,
    addressSnapshot: null,
    notes: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-02"),
  };
}

function serviceForListForAdmin(
  rows: Array<ReturnType<typeof makeFulfilmentRow> & { lotTitle: string | null }>,
  opts?: { total?: number },
) {
  const total = opts?.total ?? rows.length;
  const fulfilmentRepo = {
    listForAdmin: vi.fn().mockResolvedValue({
      items: rows,
      total,
    }),
    countMatching: vi.fn().mockResolvedValue(total),
    summarizeForAdmin: vi.fn().mockResolvedValue({
      total,
      awaitingPickup: total,
      inTransit: 0,
      statusCounts: { awaiting_release: total },
    }),
  } as unknown as ILotFulfilmentRepository;

  return {
    svc: new LotFulfilmentService({} as never, fulfilmentRepo),
    fulfilmentRepo,
  };
}

describe("LotFulfilmentService.listForAdmin", () => {
  it("maps lot titles onto fulfilment rows", async () => {
    const row = { ...makeFulfilmentRow(), lotTitle: "Blue vase" };
    const { svc } = serviceForListForAdmin([row]);
    const result = await svc.listForAdmin();
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.lotTitle).toBe("Blue vase");
    expect(result.items[0]?.lotId).toBe(lotId);
    expect(result.total).toBe(1);
  });

  it("applies search filter when q is provided", async () => {
    const row = { ...makeFulfilmentRow(), lotTitle: "Blue vase" };
    const { svc, fulfilmentRepo } = serviceForListForAdmin([row]);
    const result = await svc.listForAdmin({ q: "vase" });
    expect(fulfilmentRepo.listForAdmin).toHaveBeenCalledWith({ q: "vase" });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.lotTitle).toBe("Blue vase");
  });

  it("applies search filter for UUID needles", async () => {
    const row = { ...makeFulfilmentRow(), lotTitle: "Matched lot" };
    const { svc, fulfilmentRepo } = serviceForListForAdmin([row]);
    await svc.listForAdmin({ q: lotId });
    expect(fulfilmentRepo.listForAdmin).toHaveBeenCalledWith({ q: lotId });
  });

  it("returns paginated total", async () => {
    const row = { ...makeFulfilmentRow(), lotTitle: "Blue vase" };
    const { svc } = serviceForListForAdmin([row], { total: 42 });
    const result = await svc.listForAdmin({ limit: 10, offset: 0 });
    expect(result.total).toBe(42);
  });
});
