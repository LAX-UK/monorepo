import { describe, expect, it, vi } from "vitest";
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
      viewer: { role: "staff", staffRole: "catalogue_manager" },
    });
    await lotReadHttp.listLots({
      query: { limit: 5, offset: 0, needsPhotos: "1", resolveImages: "1" },
      viewer: { role: "staff", staffRole: "catalogue_manager" },
    });

    expect(listLotsForPublicApi).toHaveBeenCalledTimes(2);
  });
});
