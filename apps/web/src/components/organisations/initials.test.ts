import { describe, expect, it } from "vitest";
import { initials } from "./initials";

describe("initials", () => {
  it("takes the first two meaningful words, skipping joining words", () => {
    expect(initials("Cedar & Stone Fine Art")).toBe("CS");
    expect(initials("Northbank Gallery")).toBe("NG");
    expect(initials("Maya Okafor")).toBe("MO");
    expect(initials("The Hepworth Trust")).toBe("HT");
    expect(initials("Crowley Arts and Foundation")).toBe("CA");
  });

  it("uses two letters of a one-word name and copes with empty input", () => {
    expect(initials("Harrington")).toBe("HA");
    expect(initials("  ")).toBe("?");
    expect(initials("(Studio) Nine")).toBe("SN");
  });
});
