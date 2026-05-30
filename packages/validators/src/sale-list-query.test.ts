import { describe, expect, it } from "vitest";
import { listSalesQuerySchema } from "./sale.js";

describe("listSalesQuerySchema needsSetup", () => {
  it("accepts needsSetup=1", () => {
    const parsed = listSalesQuerySchema.parse({ needsSetup: "1", status: "draft" });
    expect(parsed.needsSetup).toBe("1");
    expect(parsed.status).toBe("draft");
  });
});
