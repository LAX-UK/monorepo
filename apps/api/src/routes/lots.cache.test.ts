import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import { CachedCatalogueListService } from "../services/cached-catalogue-list.service.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { ICacheProvider } from "../services/interfaces/cache.js";
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
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    lotService: { listLotsForPublicApi },
    saleService: { findByIds: vi.fn().mockResolvedValue([]) },
    mediaUrlResolver: {
      resolve: vi.fn(async (url: string) => url),
      resolveMany: vi.fn(async (urls: string[]) => urls),
    },
    lotSoftDeleteService: { getDeleteEligibilityBatch: vi.fn() },
    lotLifecycleQueryService: { getSnapshotsForLots: vi.fn().mockResolvedValue(new Map()) },
    cachedCatalogueListService,
    redis: null,
    env: {},
    kycService: null,
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
