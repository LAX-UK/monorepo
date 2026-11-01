import type { SaleResultsSummary } from "@auction/domain";
import type { Sale } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { CachedCatalogueListService } from "../cached-catalogue-list.service.js";
import type { ICacheProvider } from "../interfaces/cache.js";
import type { ISaleResultsSummaryService } from "../sale-results-summary.service.js";
import { CatalogSaleReadHttpApplicationService } from "./catalog-sale-read-http-application.service.js";

const memoryCache = (): ICacheProvider => {
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
};

const finalSummary: SaleResultsSummary = {
  state: "final",
  lotCount: 24,
  soldCount: 18,
  currency: "GBP",
  totalWithPremium: "186400.00",
  topLot: { lotId: "lot-9", priceWithPremium: "42000.00" },
  endedAt: "2026-10-31T18:00:00.000Z",
};

const endedSale = { id: "s1", title: "Autumn", status: "ended" } as Sale;

function build(input: {
  rows?: unknown[];
  detail?: unknown;
  summaries?: Map<string, SaleResultsSummary>;
}) {
  const summarise = vi.fn(async () => input.summaries ?? new Map<string, SaleResultsSummary>());
  const saleResults: ISaleResultsSummaryService = { summarise };
  const http = new CatalogSaleReadHttpApplicationService(
    { listForPublicApi: vi.fn(async () => ({ data: input.rows ?? [] })) } as never,
    new CachedCatalogueListService(memoryCache(), 20),
    {} as never,
    {} as never,
    { getSaleDetailForPublicApi: vi.fn(async () => input.detail ?? null) } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    saleResults,
  );
  return { http, summarise };
}

describe("GET /sales?status=ended rows", () => {
  it("carry the results summary the list read attached", async () => {
    const { http } = build({
      rows: [
        { sale: endedSale, lotCount: 24, previewLots: [], resultsSummary: finalSummary },
        {
          sale: { ...endedSale, id: "s2" },
          lotCount: 10,
          previewLots: [],
          resultsSummary: { state: "finalising", pendingLotCount: 2 },
        },
      ],
    });
    const res = await http.listSales({
      query: { status: "ended", sort: "endDesc", limit: 20, offset: 0 },
      viewer: {},
    });
    expect(res.status).toBe(200);
    const rows = (res.body as { data: Record<string, unknown>[] }).data;
    expect(rows.map((r) => r.resultsSummary)).toEqual([
      finalSummary,
      { state: "finalising", pendingLotCount: 2 },
    ]);
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual([
      "lotCount",
      "lots",
      "resultsSummary",
      "sale",
    ]);
  });

  it("has a null summary for a sale that has not ended", async () => {
    const { http } = build({
      rows: [
        {
          sale: { ...endedSale, status: "scheduled" },
          lotCount: 4,
          previewLots: [],
          resultsSummary: null,
        },
      ],
    });
    const res = await http.listSales({
      query: { sort: "createdDesc", limit: 20, offset: 0 },
      viewer: {},
    });
    const rows = (res.body as { data: { resultsSummary: unknown }[] }).data;
    expect(rows[0]?.resultsSummary).toBeNull();
  });
});

describe("GET /sales/:id", () => {
  const detail = {
    data: { sale: endedSale, lots: [], viewer: { isFollowing: false } },
  };

  it("carries the final summary", async () => {
    const { http, summarise } = build({
      detail,
      summaries: new Map([["s1", finalSummary]]),
    });
    const res = await http.getSaleDetail({ saleId: "s1", viewer: {} });
    expect(res.status).toBe(200);
    const data = (res.body as { data: Record<string, unknown> }).data;
    expect(Object.keys(data).sort()).toEqual(["lots", "resultsSummary", "sale", "viewer"]);
    expect(data.resultsSummary).toEqual(finalSummary);
    expect(summarise).toHaveBeenCalledWith([endedSale]);
  });

  it("carries a null summary before the sale has results", async () => {
    const { http } = build({ detail });
    const res = await http.getSaleDetail({ saleId: "s1", viewer: {} });
    expect((res.body as { data: { resultsSummary: unknown } }).data.resultsSummary).toBeNull();
  });

  it("is 404 for an unknown or non-public sale", async () => {
    const { http } = build({});
    const res = await http.getSaleDetail({ saleId: "s1", viewer: {} });
    expect(res.status).toBe(404);
  });
});
