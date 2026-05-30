import { describe, expect, it } from "vitest";
import { listLotsQuerySchema } from "./lot.js";

describe("listLotsQuerySchema", () => {
  it("accepts needsPhotos=1 for attention lens filtering", () => {
    const parsed = listLotsQuerySchema.parse({
      status: "draft",
      needsPhotos: "1",
      limit: 20,
      offset: 0,
    });
    expect(parsed.needsPhotos).toBe("1");
    expect(parsed.status).toBe("draft");
  });

  it("omits needsPhotos when not provided", () => {
    const parsed = listLotsQuerySchema.parse({ limit: 20, offset: 0 });
    expect(parsed.needsPhotos).toBeUndefined();
  });
});
