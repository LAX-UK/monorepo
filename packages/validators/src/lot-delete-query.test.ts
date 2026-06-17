import { describe, expect, it } from "vitest";
import { bulkLotsBodySchema, lotDeleteConfirmationPhrase } from "./lot.js";

describe("lotDeleteConfirmationPhrase", () => {
  it("prefixes lot title with DELETE", () => {
    expect(lotDeleteConfirmationPhrase("Blue vase")).toBe("DELETE Blue vase");
  });
});

describe("bulkLotsBodySchema", () => {
  const lotId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  it("dedupes duplicate ids while preserving order", () => {
    const parsed = bulkLotsBodySchema.parse({
      ids: [lotId, lotId],
      op: "soft_delete",
      confirmationPhrase: "DELETE 1 DRAFT LOTS",
    });
    expect(parsed.ids).toEqual([lotId]);
  });
});
