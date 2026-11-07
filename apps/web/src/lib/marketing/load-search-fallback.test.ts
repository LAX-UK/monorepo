import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  count: vi.fn(),
  sales: vi.fn(),
  artists: vi.fn(),
}));
vi.mock("@/lib/catalog/catalog.server", () => ({
  getServerLotReader: async () => ({ list: mocks.list }),
  getServerLotCount: mocks.count,
  getServerSalesList: mocks.sales,
}));
vi.mock("@/lib/data/http/artist.reader", () => ({ fetchPublicArtistBrowse: mocks.artists }));

import { loadSearchFallback } from "@/lib/marketing/load-search-fallback";
import { SEARCH_FALLBACK_SALE_LIMIT } from "@/lib/marketing/search-fallback";

const row = { sale: { id: "s1", title: "Winter evening sale" }, lots: [], lotCount: 0 };

beforeEach(() => {
  mocks.list.mockReset().mockResolvedValue([]);
  mocks.count.mockReset().mockResolvedValue(0);
  mocks.artists.mockReset().mockResolvedValue({ rows: [], total: 0 });
  mocks.sales.mockReset().mockResolvedValue([row]);
});

describe("loadSearchFallback sales", () => {
  it("asks for a few sales matching the same text", async () => {
    const fallback = await loadSearchFallback("winter");
    expect(mocks.sales).toHaveBeenCalledWith({ q: "winter", limit: SEARCH_FALLBACK_SALE_LIMIT });
    expect(fallback.sales).toEqual([row]);
  });

  it("keeps past results and artists when the sales read fails", async () => {
    mocks.sales.mockRejectedValue(new Error("down"));
    mocks.count.mockResolvedValue(2);
    const fallback = await loadSearchFallback("winter");
    expect(fallback.sales).toEqual([]);
    expect(fallback.pastCount).toBe(2);
  });
});
