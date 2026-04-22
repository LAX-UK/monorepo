import { describe, expect, it, vi } from "vitest";
import type { ISaleBiddersReader, SaleBidderRow } from "./interfaces/sale-bidders.js";
import type { ISaleExistenceReader } from "./interfaces/sale-follow.js";
import { SaleBiddersService } from "./sale-bidders.service.js";

describe("SaleBiddersService", () => {
  it("returns null when sale is missing (no reader hit)", async () => {
    const reader: ISaleBiddersReader = {
      list: vi.fn(async () => []),
      countDistinct: vi.fn(async () => 0),
    };
    const sales: ISaleExistenceReader = { findById: vi.fn(async () => null) };
    const svc = new SaleBiddersService(reader, sales);
    const res = await svc.list("missing", { limit: 10, offset: 0 });
    expect(res).toBeNull();
    expect(reader.list).not.toHaveBeenCalled();
  });

  it("returns paginated bidders with total count", async () => {
    const items: SaleBidderRow[] = [
      { maskedName: "Alex R.", firstBidAt: new Date("2026-01-01") },
      { maskedName: "Jordan K.", firstBidAt: new Date("2026-01-02") },
    ];
    const reader: ISaleBiddersReader = {
      list: vi.fn(async () => items),
      countDistinct: vi.fn(async () => 42),
    };
    const sales: ISaleExistenceReader = { findById: vi.fn(async () => ({ id: "sale-1" })) };
    const svc = new SaleBiddersService(reader, sales);
    const res = await svc.list("sale-1", { limit: 2, offset: 0 });
    expect(res?.items).toEqual(items);
    expect(res?.total).toBe(42);
  });
});
