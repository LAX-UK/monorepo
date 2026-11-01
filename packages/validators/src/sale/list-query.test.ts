import { describe, expect, it } from "vitest";
import { listSalesQuerySchema } from "./list-query.js";

describe("listSalesQuerySchema sort", () => {
  it("accepts newest-ended-first for results", () => {
    expect(listSalesQuerySchema.parse({ sort: "endDesc" }).sort).toBe("endDesc");
  });

  it("keeps the newest-created default and rejects unknown orders", () => {
    expect(listSalesQuerySchema.parse({}).sort).toBe("createdDesc");
    expect(listSalesQuerySchema.safeParse({ sort: "random" }).success).toBe(false);
  });
});
