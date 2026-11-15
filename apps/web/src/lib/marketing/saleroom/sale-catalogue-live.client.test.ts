import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const browserFetch = vi.fn();
vi.mock("@/lib/data/http/hc-browser", () => ({
  browserApiBase: () => "/api/bff",
  browserFetch: (...args: unknown[]) => browserFetch(...args),
}));

import { fetchSaleCatalogueLive } from "./sale-catalogue-live.client";

const row = {
  id: "lot-1",
  saleId: "sale-1",
  title: "Harbour",
  lotNumber: 1,
  currentPrice: "7000.00",
  startingPrice: "4200.00",
  startTime: "2026-11-03T10:00:00.000Z",
  endTime: "2099-11-03T21:00:00.000Z",
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
  status: "active",
  images: [],
};

const input = {
  saleId: "sale-1",
  reads: [
    { limit: 48, offset: 0, sort: "lot" },
    { limit: 48, offset: 48, sort: "lot" },
  ],
  premiumSale: { buyerPremiumRate: null, buyerPremiumTiers: null },
} as never;

describe("fetchSaleCatalogueLive (CO-7)", () => {
  beforeAll(async () => {
    await import("@/lib/data/http/sales.schema");
    await import("@/lib/marketing/saleroom/mappers");
  }, 30_000);
  beforeEach(() => browserFetch.mockReset());

  it("repeats each catalogue page no-store and maps each lot's live fields", async () => {
    browserFetch.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => ({
        data: {
          items: url.includes("offset=0") ? [row] : [],
          total: 1,
          limit: 48,
          offset: 0,
        },
      }),
    }));
    const live = await fetchSaleCatalogueLive(input);
    expect(browserFetch).toHaveBeenCalledTimes(2);
    for (const call of browserFetch.mock.calls) {
      expect(call[1]).toEqual({ cache: "no-store" });
    }
    expect(browserFetch.mock.calls[0]?.[0]).toBe(
      "/api/bff/sales/sale-1/lots?limit=48&offset=0&sort=lot",
    );
    const fields = live?.get("lot-1");
    expect(fields?.status).toBe("active");
    expect(fields?.isLive).toBe(true);
    expect(fields?.cardLine.value).toMatch(/7,000/);
  });

  it("is null when a read fails, so the cards keep their placeholders", async () => {
    browserFetch.mockResolvedValue({ ok: false, json: async () => ({}) });
    await expect(fetchSaleCatalogueLive(input)).resolves.toBeNull();
  });
});
