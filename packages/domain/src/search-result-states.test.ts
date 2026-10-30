import { describe, expect, it } from "vitest";
import { bidOutcome } from "./search-result-states.js";

describe("bidOutcome", () => {
  it("open lots: leading or outbid", () => {
    expect(bidOutcome({ lotStatus: "active", leading: true, won: false })).toBe("leading");
    expect(bidOutcome({ lotStatus: "active", leading: false, won: false })).toBe("outbid");
  });

  it("closed lots: won or lost", () => {
    expect(bidOutcome({ lotStatus: "ended", leading: false, won: true })).toBe("won");
    expect(bidOutcome({ lotStatus: "ended", leading: true, won: false })).toBe("lost");
  });

  it.each(["draft", "scheduled", "cancelled", "voided"] as const)("%s: no outcome", (lotStatus) => {
    expect(bidOutcome({ lotStatus, leading: true, won: true })).toBeNull();
  });
});
