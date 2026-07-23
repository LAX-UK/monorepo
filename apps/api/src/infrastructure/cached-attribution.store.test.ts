import type { IAttributionStore } from "@auction/marketing-events";
import type { MarketingAttributionSnapshot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { CachedAttributionStore } from "./cached-attribution.store.js";

const firstTouch = {
  capturedAt: "2026-01-01T00:00:00.000Z",
  landingPath: "/first",
  utmSource: "newsletter",
};

const lastTouch = {
  capturedAt: "2026-01-02T00:00:00.000Z",
  landingPath: "/last",
  utmSource: "paid",
};

function storeMock(): IAttributionStore {
  return {
    put: vi.fn().mockResolvedValue(undefined),
    get: vi.fn(),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

describe("CachedAttributionStore", () => {
  it("writes the canonical Postgres-merged snapshot to cache", async () => {
    const incoming: MarketingAttributionSnapshot = { version: 1, lastTouch };
    const merged: MarketingAttributionSnapshot = { version: 1, firstTouch, lastTouch };
    const primary = storeMock();
    const cache = storeMock();
    vi.mocked(primary.get).mockResolvedValue(merged);

    await new CachedAttributionStore(primary, cache).put("user-1", incoming);

    expect(primary.put).toHaveBeenCalledWith("user-1", incoming);
    expect(cache.put).toHaveBeenCalledWith("user-1", merged);
  });

  it("does not extend Redis retention when falling back to Postgres", async () => {
    const row: MarketingAttributionSnapshot = { version: 1, firstTouch, lastTouch };
    const primary = storeMock();
    const cache = storeMock();
    vi.mocked(cache.get).mockResolvedValue(null);
    vi.mocked(primary.get).mockResolvedValue(row);

    await expect(new CachedAttributionStore(primary, cache).get("user-1")).resolves.toEqual(row);
    expect(cache.put).not.toHaveBeenCalled();
  });

  it("keeps durable writes successful when Redis is unavailable", async () => {
    const snapshot: MarketingAttributionSnapshot = { version: 1, firstTouch, lastTouch };
    const primary = storeMock();
    const cache = storeMock();
    vi.mocked(primary.get).mockResolvedValue(snapshot);
    vi.mocked(cache.put).mockRejectedValue(new Error("redis unavailable"));

    await expect(
      new CachedAttributionStore(primary, cache).put("user-1", snapshot),
    ).resolves.toBeUndefined();
  });

  it("propagates cache deletion failure so consent withdrawal can retry", async () => {
    const primary = storeMock();
    const cache = storeMock();
    vi.mocked(cache.delete).mockRejectedValue(new Error("redis unavailable"));

    await expect(new CachedAttributionStore(primary, cache).delete("user-1")).rejects.toThrow(
      "redis unavailable",
    );
    expect(primary.delete).toHaveBeenCalledWith("user-1");
  });
});
