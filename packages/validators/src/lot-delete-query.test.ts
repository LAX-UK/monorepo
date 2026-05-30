import { describe, expect, it } from "vitest";
import { lotDeleteConfirmationPhrase } from "@auction/validators";

describe("lotDeleteConfirmationPhrase", () => {
  it("prefixes lot title with DELETE", () => {
    expect(lotDeleteConfirmationPhrase("Blue vase")).toBe("DELETE Blue vase");
  });
});
