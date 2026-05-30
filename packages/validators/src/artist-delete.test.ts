import { describe, expect, it } from "vitest";
import { artistDeleteConfirmationPhrase } from "./artist.js";

describe("artistDeleteConfirmationPhrase", () => {
  it("trims display name whitespace", () => {
    expect(artistDeleteConfirmationPhrase("  Blue Period  ")).toBe("DELETE Blue Period");
  });

  it("preserves internal spacing and special characters", () => {
    expect(artistDeleteConfirmationPhrase("O'Keeffe")).toBe("DELETE O'Keeffe");
  });
});
