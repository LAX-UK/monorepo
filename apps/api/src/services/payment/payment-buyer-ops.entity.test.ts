import { describe, expect, it, vi } from "vitest";
import { listEntityPaymentsForBuyerApi, listEntityWonLots } from "./payment-buyer-ops.js";
import type { PaymentServiceDeps } from "./payment-service-types.js";

const entityId = "22222222-2222-4222-8222-222222222222";

function lotRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "lot-1",
    saleId: "sale-1",
    lotNumber: 7,
    title: "Blue Study",
    images: ["lots/blue.jpg"],
    currentPrice: "1200.00",
    endTime: new Date("2026-05-01T12:00:00.000Z"),
    ...overrides,
  };
}

function deps(overrides: Record<string, unknown> = {}) {
  return {
    lots: { list: vi.fn(async () => [lotRow()]), findById: vi.fn(async () => null) },
    payments: {
      listByBuyerLegalEntityId: vi.fn(async () => []),
      listByBuyerId: vi.fn(async () => []),
    },
    mediaUrlResolver: { resolveMany: vi.fn(async () => ["https://cdn.test/blue.jpg"]) },
    ...overrides,
  } as unknown as PaymentServiceDeps;
}

describe("listEntityWonLots", () => {
  it("asks for ended lots won for the organisation, newest first", async () => {
    const d = deps();

    await listEntityWonLots(d, entityId, { limit: 20, offset: 40, includeHammerPrice: true });

    expect(d.lots.list).toHaveBeenCalledWith({
      buyerLegalEntityId: entityId,
      statuses: ["ended"],
      sort: "endedDesc",
      resolveImages: false,
      limit: 20,
      offset: 40,
    });
  });

  it("includes the hammer price only when the caller may see money", async () => {
    const withPrice = await listEntityWonLots(deps(), entityId, {
      limit: 10,
      offset: 0,
      includeHammerPrice: true,
    });
    const withoutPrice = await listEntityWonLots(deps(), entityId, {
      limit: 10,
      offset: 0,
      includeHammerPrice: false,
    });

    expect(withPrice.data[0]).toMatchObject({ hammerPrice: "1200.00", title: "Blue Study" });
    expect(withoutPrice.data[0]).not.toHaveProperty("hammerPrice");
    expect(withoutPrice.data[0]).toMatchObject({
      lotId: "lot-1",
      imageUrl: "https://cdn.test/blue.jpg",
      endedAt: "2026-05-01T12:00:00.000Z",
    });
  });

  it("has no image url for a lot without images", async () => {
    const d = deps({
      lots: { list: vi.fn(async () => [lotRow({ images: [] })]) },
    });

    const { data } = await listEntityWonLots(d, entityId, {
      limit: 10,
      offset: 0,
      includeHammerPrice: false,
    });

    expect(data[0]?.imageUrl).toBeNull();
  });
});

describe("listEntityPaymentsForBuyerApi", () => {
  it("reads payments by buyer entity, not by person", async () => {
    const d = deps();

    const { data } = await listEntityPaymentsForBuyerApi(d, entityId, {});

    expect(data).toEqual([]);
    expect(d.payments.listByBuyerLegalEntityId).toHaveBeenCalledWith(entityId);
    expect(d.payments.listByBuyerId).not.toHaveBeenCalled();
  });
});
