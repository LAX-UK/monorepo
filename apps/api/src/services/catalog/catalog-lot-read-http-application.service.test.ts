import { describe, expect, it, vi } from "vitest";
import { withPublicLotResults } from "../../lib/public-lot-result.js";
import { createCatalogLotReadHttpFixture } from "../../testing/catalog-lot-read-http-fixture.js";
import { CachedCatalogueListService } from "../cached-catalogue-list.service.js";
import type { ICacheProvider } from "../interfaces/cache.js";

function createMemoryCache(): ICacheProvider {
  const store = new Map<string, string>();
  return {
    get: async (key) => store.get(key) ?? null,
    set: async (key, value) => {
      store.set(key, value);
    },
    del: async (key) => {
      store.delete(key);
    },
  };
}

describe("CatalogLotReadHttpApplicationService", () => {
  it("deduplicates anonymous list loads via cached catalogue service", async () => {
    const listLotsForPublicApi = vi.fn().mockResolvedValue({ data: [] });
    const cachedCatalogueListService = new CachedCatalogueListService(createMemoryCache(), 60);
    const lotReadHttp = createCatalogLotReadHttpFixture({
      lotService: {
        listLotsForPublicApi,
        getById: vi.fn(),
        countMatching: vi.fn(),
        archiveEndedSummary: vi.fn(),
      },
      cachedCatalogueListService,
    });
    const query = { limit: 10, offset: 0, resolveImages: "1" as const };

    await lotReadHttp.listLots({ query, viewer: {} });
    await lotReadHttp.listLots({ query, viewer: {} });

    expect(listLotsForPublicApi).toHaveBeenCalledTimes(1);
  });

  it("skips anonymous cache when needsPhotos is requested", async () => {
    const listLotsForPublicApi = vi.fn().mockResolvedValue({ data: [] });
    const cachedCatalogueListService = new CachedCatalogueListService(createMemoryCache(), 60);
    const lotReadHttp = createCatalogLotReadHttpFixture({
      lotService: {
        listLotsForPublicApi,
        getById: vi.fn(),
        countMatching: vi.fn(),
        archiveEndedSummary: vi.fn(),
      },
      cachedCatalogueListService,
    });

    await lotReadHttp.listLots({
      query: { limit: 5, offset: 0, needsPhotos: "1", resolveImages: "1" },
      viewer: { role: "staff", staffRoles: ["cataloguer"] },
    });
    await lotReadHttp.listLots({
      query: { limit: 5, offset: 0, needsPhotos: "1", resolveImages: "1" },
      viewer: { role: "staff", staffRoles: ["cataloguer"] },
    });

    expect(listLotsForPublicApi).toHaveBeenCalledTimes(2);
  });

  describe("lot detail of a withdrawn lot", () => {
    const publicSale = { id: "s1", status: "ended", buyerPremiumTiers: null };
    const lot = (status: string, saleId: string | null = "s1") => ({
      id: "lot-1",
      saleId,
      lotNumber: 3,
      title: "Harbour lights",
      description: null,
      medium: "Oil",
      dimensions: null,
      images: [],
      categoryId: "c1",
      auctionType: "english",
      status,
      startingPrice: "100.00",
      reservePrice: "500.00",
      currentPrice: "900.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "10.00",
      winnerId: "buyer-1",
      startTime: new Date("2026-10-01T10:00:00Z"),
      endTime: new Date("2026-10-31T10:00:00Z"),
      marketingDetails: { estimate: { low: "1000", high: "2000", currency: "GBP" } },
    });
    const detail = (found: ReturnType<typeof lot>, sale: unknown = publicSale) =>
      createCatalogLotReadHttpFixture({
        lotService: {
          listLotsForPublicApi: vi.fn(),
          getById: vi.fn().mockResolvedValue(found),
        },
        saleService: { getByIdForPublicCatalog: vi.fn().mockResolvedValue(sale) } as never,
        cachedCatalogueListService: new CachedCatalogueListService(createMemoryCache(), 60),
        now: () => new Date("2026-11-01T12:00:00Z"),
      });

    it("is public with the status withdrawn and no price, history or actions", async () => {
      const res = await detail(lot("cancelled")).getLotDetail({ lotId: "lot-1", viewer: {} });
      expect(res.status).toBe(200);
      const data = (res.body as { data: Record<string, unknown> }).data;
      expect(data).toMatchObject({ id: "lot-1", status: "withdrawn", title: "Harbour lights" });
      for (const key of [
        "currentPrice",
        "startingPrice",
        "reservePrice",
        "winnerId",
        "marketingDetails",
        "checkoutPricing",
        "nextBidAmount",
        "validBidAmounts",
        "buyersPremium",
        "hammerPrice",
        "soldForWithPremium",
        "startTime",
        "endTime",
      ]) {
        expect(data).not.toHaveProperty(key);
      }
    });

    it("stays unknown for a voided lot", async () => {
      const res = await detail(lot("voided")).getLotDetail({ lotId: "lot-1", viewer: {} });
      expect(res.status).toBe(404);
    });

    it("stays unknown when the sale is not public or the lot has no sale", async () => {
      const draftSale = { id: "s1", status: "draft", buyerPremiumTiers: null };
      expect(
        (await detail(lot("cancelled"), draftSale).getLotDetail({ lotId: "lot-1", viewer: {} }))
          .status,
      ).toBe(404);
      expect(
        (await detail(lot("cancelled", null), null).getLotDetail({ lotId: "lot-1", viewer: {} }))
          .status,
      ).toBe(404);
    });

    it("gives staff the full lot", async () => {
      const res = await detail(lot("cancelled")).getLotDetail({
        lotId: "lot-1",
        viewer: { role: "staff", staffRoles: ["cataloguer"] },
      });
      expect(res.status).toBe(200);
      expect((res.body as { data: Record<string, unknown> }).data).toMatchObject({
        status: "cancelled",
        currentPrice: "900.00",
      });
    });
  });

  describe("lot detail while the result is still open", () => {
    const publicSale = { id: "s1", status: "ended", buyerPremiumTiers: null };
    const defaulted = {
      id: "lot-1",
      saleId: "s1",
      lotNumber: 3,
      title: "Harbour lights",
      description: null,
      medium: "Oil",
      dimensions: null,
      images: [],
      categoryId: "c1",
      auctionType: "english",
      status: "ended",
      startingPrice: "100.00",
      reservePrice: "500.00",
      currentPrice: "88000.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "10.00",
      winnerId: "next-bidder-user",
      buyerLegalEntityId: "next-bidder-entity",
      startTime: new Date("2026-10-01T10:00:00Z"),
      endTime: new Date("2026-10-31T10:00:00Z"),
      marketingDetails: {},
    };
    const open = (pendingIds: string[]) =>
      createCatalogLotReadHttpFixture({
        lotService: {
          listLotsForPublicApi: vi.fn(),
          getById: vi.fn().mockResolvedValue(defaulted),
          presentForPublic: (lots: readonly { id: string }[]) =>
            withPublicLotResults(
              {
                pendingAmong: async (ids: readonly string[]) =>
                  new Set(ids.filter((id) => pendingIds.includes(id))),
              },
              lots as never,
            ),
        } as never,
        saleService: { getByIdForPublicCatalog: vi.fn().mockResolvedValue(publicSale) } as never,
        cachedCatalogueListService: new CachedCatalogueListService(createMemoryCache(), 60),
        now: () => new Date("2026-11-01T12:00:00Z"),
      });

    it("says only that the lot ended: no buyer, no price, no hammer, nothing of the offer", async () => {
      const res = await open(["lot-1"]).getLotDetail({ lotId: "lot-1", viewer: {} });
      expect(res.status).toBe(200);
      const data = (res.body as { data: Record<string, unknown> }).data;
      expect(data).toMatchObject({
        status: "ended",
        resultPending: true,
        winnerId: null,
        hammerPrice: null,
        soldForWithPremium: null,
      });
      const json = JSON.stringify(data);
      for (const secret of ["88000", "next-bidder", "reoffer", "default"]) {
        expect(json).not.toContain(secret);
      }
    });

    it("shows a lot whose result is final as sold", async () => {
      const res = await open([]).getLotDetail({ lotId: "lot-1", viewer: {} });
      const data = (res.body as { data: Record<string, unknown> }).data;
      expect(data).toMatchObject({ winnerId: "next-bidder-user", hammerPrice: "88000.00" });
      expect(data).not.toHaveProperty("resultPending");
    });

    it("gives staff the real buyer and price", async () => {
      const res = await open(["lot-1"]).getLotDetail({
        lotId: "lot-1",
        viewer: { role: "staff", staffRoles: ["cataloguer"] },
      });
      const data = (res.body as { data: Record<string, unknown> }).data;
      expect(data).toMatchObject({ winnerId: "next-bidder-user", currentPrice: "88000.00" });
      expect(data).not.toHaveProperty("resultPending");
    });
  });
});
