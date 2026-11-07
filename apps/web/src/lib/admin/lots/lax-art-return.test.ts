import { describe, expect, it } from "vitest";
import { laxArtReturnSuccessHint, laxArtReturnSuccessMessage } from "./lax-art-return";

describe("laxArtReturnSuccessMessage", () => {
  it("says a draft is back on lax.art when the listing was reopened", () => {
    expect(laxArtReturnSuccessMessage("Blue", { laxArtListing: true })).toBe(
      "Blue is back on lax.art as a draft",
    );
  });

  it("falls back to the draft wording when the answer is missing", () => {
    expect(laxArtReturnSuccessMessage("Blue", null)).toBe("Blue is back on lax.art as a draft");
  });

  it("says no draft was made when the artwork was never listed", () => {
    expect(laxArtReturnSuccessMessage("Blue", { laxArtListing: false })).toBe(
      "Blue is back with LAX. It was never listed on lax.art, so no draft was made.",
    );
  });
});

describe("laxArtReturnSuccessHint", () => {
  it("passes the hint on only when there is no listing", () => {
    expect(laxArtReturnSuccessHint({ laxArtListing: false, hint: "Only the register." })).toBe(
      "Only the register.",
    );
    expect(laxArtReturnSuccessHint({ laxArtListing: true, hint: "Ignored" })).toBe("");
    expect(laxArtReturnSuccessHint({ laxArtListing: false })).toBe("");
    expect(laxArtReturnSuccessHint(null)).toBe("");
  });
});
