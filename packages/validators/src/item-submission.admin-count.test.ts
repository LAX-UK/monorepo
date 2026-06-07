import { describe, expect, it } from "vitest";
import { adminSubmissionCountBySellersQuerySchema } from "./item-submission.js";

describe("adminSubmissionCountBySellersQuerySchema", () => {
  it("parses comma-separated seller UUIDs", () => {
    const parsed = adminSubmissionCountBySellersQuerySchema.parse({
      sellerIds: "11111111-1111-4111-8111-111111111111,22222222-2222-4222-8222-222222222222",
    });
    expect(parsed.sellerIds).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ]);
  });

  it("returns empty array when sellerIds omitted", () => {
    const parsed = adminSubmissionCountBySellersQuerySchema.parse({});
    expect(parsed.sellerIds).toEqual([]);
  });
});
