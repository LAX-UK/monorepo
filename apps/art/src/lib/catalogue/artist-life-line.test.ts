import { describe, expect, it } from "vitest";
import { artistLifeLine } from "./artist-life-line.js";

describe("artistLifeLine", () => {
  it("joins nationality with life dates", () => {
    expect(artistLifeLine({ nationality: "British", birthYear: 1924, deathYear: 2001 })).toBe(
      "British, 1924–2001",
    );
    expect(artistLifeLine({ nationality: " Italian ", birthYear: 1978, deathYear: null })).toBe(
      "Italian, b. 1978",
    );
  });

  it("falls back to whichever part exists and is null for neither", () => {
    expect(artistLifeLine({ nationality: "British" })).toBe("British");
    expect(artistLifeLine({ birthYear: 1960 })).toBe("b. 1960");
    expect(artistLifeLine({ nationality: "  ", birthYear: null, deathYear: 2001 })).toBeNull();
    expect(artistLifeLine({})).toBeNull();
  });
});
