import { describe, expect, it } from "vitest";
import { adminDeliveriesListQuerySchema } from "./admin-deliveries.js";

describe("adminDeliveriesListQuerySchema", () => {
  it("opens on Waiting for a price, newest first, 50 rows", () => {
    expect(adminDeliveriesListQuerySchema.parse({})).toEqual({
      view: "waiting",
      sort: "newest",
      limit: 50,
      offset: 0,
    });
  });

  it("reads a view, a search, a sale and paging from the query string", () => {
    expect(
      adminDeliveriesListQuerySchema.parse({
        view: "on_the_way",
        q: "  Lyon ",
        saleId: "5b2f6c1e-3d4a-4b5c-8d9e-0f1a2b3c4d5e",
        sort: "oldest",
        limit: "25",
        offset: "50",
      }),
    ).toEqual({
      view: "on_the_way",
      q: "Lyon",
      saleId: "5b2f6c1e-3d4a-4b5c-8d9e-0f1a2b3c4d5e",
      sort: "oldest",
      limit: 25,
      offset: 50,
    });
  });

  it("refuses an unknown view, a bad sale id, too many rows and unknown keys", () => {
    expect(adminDeliveriesListQuerySchema.safeParse({ view: "requested" }).success).toBe(false);
    expect(adminDeliveriesListQuerySchema.safeParse({ saleId: "sale-1" }).success).toBe(false);
    expect(adminDeliveriesListQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
    expect(adminDeliveriesListQuerySchema.safeParse({ country: "FR" }).success).toBe(false);
  });
});
