import { lotDeleteConfirmationPhrase } from "@auction/validators";
import { describe, expect, it } from "vitest";

describe("lotDeleteConfirmationPhrase", () => {
  it("prefixes lot title with DELETE", () => {
    expect(lotDeleteConfirmationPhrase("Blue vase")).toBe("DELETE Blue vase");
  });
});
