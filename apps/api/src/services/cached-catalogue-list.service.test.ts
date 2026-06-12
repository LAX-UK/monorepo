import { describe, expect, it, vi } from "vitest";
import { CachedCatalogueListService } from "./cached-catalogue-list.service.js";
import type { ICacheProvider } from "./interfaces/cache.js";

function createCache(initial: Record<string, string> = {}): ICacheProvider {
  const store = new Map(Object.entries(initial));
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  };
}

describe("CachedCatalogueListService", () => {
  it("buildKey sorts query params for stable cache keys", () => {
    const service = new CachedCatalogueListService(createCache());
    const key = service.buildKey("lots", { limit: 24, status: "active", offset: 0 });
    expect(key).toBe("catalogue:lots:limit=24&offset=0&status=active");
  });

  it("returns cached value on hit without calling loader", async () => {
    const cache = createCache({ "catalogue:lots:limit=24": JSON.stringify({ data: [1] }) });
    const service = new CachedCatalogueListService(cache);
    const load = vi.fn(async () => ({ data: [2] }));

    const result = await service.getOrLoad("catalogue:lots:limit=24", load);

    expect(result).toEqual({ data: [1] });
    expect(load).not.toHaveBeenCalled();
  });

  it("loads and stores value on miss", async () => {
    const cache = createCache();
    const service = new CachedCatalogueListService(cache, 30);
    const load = vi.fn(async () => ({ data: ["lot-1"] }));

    const first = await service.getOrLoad("catalogue:lots:limit=10", load);
    const second = await service.getOrLoad("catalogue:lots:limit=10", load);

    expect(first).toEqual({ data: ["lot-1"] });
    expect(second).toEqual({ data: ["lot-1"] });
    expect(load).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledWith(
      "catalogue:lots:limit=10",
      JSON.stringify({ data: ["lot-1"] }),
      30,
    );
  });

  it("falls through to loader when cache read fails", async () => {
    const cache: ICacheProvider = {
      get: vi.fn(async () => {
        throw new Error("redis down");
      }),
      set: vi.fn(async () => {}),
      del: vi.fn(async () => {}),
    };
    const service = new CachedCatalogueListService(cache);
    const load = vi.fn(async () => ({ data: ["fresh"] }));

    const result = await service.getOrLoad("catalogue:sales:", load);

    expect(result).toEqual({ data: ["fresh"] });
    expect(load).toHaveBeenCalledTimes(1);
  });
});
