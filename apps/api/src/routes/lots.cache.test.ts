import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import { CachedCatalogueListService } from "../services/cached-catalogue-list.service.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { ICacheProvider } from "../services/interfaces/cache.js";
import { createCatalogLotReadHttpFixture } from "../testing/catalog-lot-read-http-fixture.js";
import { stubBiddingRouteServices } from "../testing/stub-bidding-route-services.js";
import { stubCatalogRouteServices } from "../testing/stub-catalog-route-services.js";
import { createLotRoutes } from "./lots.js";

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

function mount() {
  const app = new Hono();
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
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    catalogRoutes: stubCatalogRouteServices({ lotReadHttp }),
    redis: null,
    env: {},
    kycService: null,
    bidding: stubBiddingRouteServices(),
    requireSubmissionsLegalEntityContext: vi.fn(),
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue(null),
  };
  app.route("/lots", createLotRoutes(container, authenticator));
  return { app, listLotsForPublicApi };
}

describe("anonymous lot list cache", () => {
  it("calls listLotsForPublicApi once for two identical anonymous requests", async () => {
    const { app, listLotsForPublicApi } = mount();

    const first = await app.request("http://t/lots?limit=10");
    const second = await app.request("http://t/lots?limit=10");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(listLotsForPublicApi).toHaveBeenCalledTimes(1);
  });
});
