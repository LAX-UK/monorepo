import { describe, expect, it } from "vitest";
import { formatCount } from "./index.js";

describe("formatCount", () => {
  it("writes counts in full with thousands separators", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(1284)).toBe("1,284");
    expect(formatCount(99_999)).toBe("99,999");
  });

  it("switches to compact form above 99,999 so a tab keeps its size", () => {
    expect(formatCount(312_000)).toBe("312k");
  });
});
