import { describe, expect, it, vi } from "vitest";
import type { CrmCoqlPage, CrmCoqlQuery } from "../../crm/crm-gateway.js";
import { artistRows, productRows } from "./fixtures/load-fixtures.js";
import { CoqlZohoCatalogueReader } from "./zoho-catalogue-reader.js";

function fakeCoql(handler: (query: string) => CrmCoqlPage): CrmCoqlQuery & { queries: string[] } {
  const queries: string[] = [];
  return {
    queries,
    queryCoql: vi.fn(async (query: string) => {
      queries.push(query);
      return handler(query);
    }),
  };
}

const page = (rows: Record<string, unknown>[], moreRecords = false): CrmCoqlPage => ({
  rows,
  moreRecords,
});

describe("CoqlZohoCatalogueReader", () => {
  it("reads one Product with its artist resolved from the Artists module", async () => {
    const coql = fakeCoql((q) =>
      q.includes("from Artists") ? page(artistRows()) : page([productRows()[0] as never]),
    );
    const found = await new CoqlZohoCatalogueReader(coql).fetchProduct("5000000000001000001");
    expect(found?.artist).toMatchObject({ name: "Aidan Phelan", code1: "PH" });
    expect(coql.queries.some((q) => q.includes("where id = '5000000000001000001'"))).toBe(true);
  });

  it("returns null for a Product Zoho does not have", async () => {
    const coql = fakeCoql((q) => (q.includes("from Artists") ? page(artistRows()) : page([])));
    expect(await new CoqlZohoCatalogueReader(coql).fetchProduct("1")).toBeNull();
  });

  it("reads changed Products page by page, oldest first, resolving artists once", async () => {
    const rows = productRows();
    const coql = fakeCoql((q) => {
      if (q.includes("from Artists")) return page(artistRows());
      if (q.includes("limit 0, 200")) return page(rows.slice(0, 4), true);
      return page(rows.slice(4));
    });
    const pages: number[] = [];
    for await (const p of new CoqlZohoCatalogueReader(coql).fetchModifiedSince(
      new Date("2026-09-01T00:00:00.000Z"),
    )) {
      pages.push(p.length);
    }
    expect(pages).toEqual([4, 3]);
    expect(coql.queries.filter((q) => q.includes("from Artists"))).toHaveLength(1);
    const productQueries = coql.queries.filter((q) => q.includes("from Products"));
    expect(productQueries[0]).toContain("Modified_Time > '2026-09-01T00:00:00+00:00'");
    expect(productQueries[0]).toContain("order by Modified_Time limit 0, 200");
    expect(productQueries[1]).toContain("limit 200, 200");
  });

  it("reads from the start of time when there is no earlier pass", async () => {
    const coql = fakeCoql((q) => (q.includes("from Artists") ? page([]) : page([])));
    for await (const _ of new CoqlZohoCatalogueReader(coql).fetchModifiedSince(null)) {
      // nothing to read
    }
    expect(coql.queries.find((q) => q.includes("from Products"))).toContain(
      "Modified_Time > '1970-01-01T00:00:00+00:00'",
    );
  });

  it("restarts from the last time reached when Zoho's offset limit is hit, without repeating Products", async () => {
    const rows = productRows();
    let productCalls = 0;
    const coql = fakeCoql((q) => {
      if (q.includes("from Artists")) return page(artistRows());
      productCalls += 1;
      if (productCalls <= 10) return page([rows[productCalls % 3] as never], true);
      return page([rows[3] as never, rows[0] as never]);
    });
    const ids: string[] = [];
    for await (const p of new CoqlZohoCatalogueReader(coql).fetchModifiedSince(
      new Date("2026-01-01T00:00:00.000Z"),
    )) {
      ids.push(...p.map((x) => x.id));
    }
    expect(new Set(ids).size).toBe(ids.length);
    const restart = coql.queries.filter((q) => q.includes("from Products")).at(-1);
    expect(restart).toContain("limit 0, 200");
    expect(restart).not.toContain("2026-01-01");
  });
});
