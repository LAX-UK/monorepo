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
    expect(formatCount(128_400)).toBe("128k");
    expect(formatCount(1_250_000)).toBe("1m");
    expect(formatCount(2_400_000_000)).toBe("2bn");
  });

  it("rounds to the nearest whole unit", () => {
    expect(formatCount(100_000)).toBe("100k");
    expect(formatCount(999_499)).toBe("999k");
    expect(formatCount(1_500_000)).toBe("2m");
    expect(formatCount(999_500)).toBe("1m");
    expect(formatCount(999_600_000)).toBe("1bn");
  });
});
