import { describe, expect, it } from "vitest";
import { formatShopDate, formatShopDateTime } from "./shop-date.presenter.js";

describe("shop date presenter", () => {
  it("formats dates in en-GB London timezone", () => {
    const iso = "2026-03-15T12:00:00.000Z";
    expect(formatShopDate(iso)).toMatch(/15 Mar 2026/);
    expect(formatShopDateTime(iso)).toMatch(/15 Mar 2026/);
  });

  it("reads the London clock on the days the clocks change", () => {
    expect(formatShopDateTime("2026-03-29T00:30:00.000Z")).toBe("29 Mar 2026, 00:30");
    expect(formatShopDateTime("2026-03-29T01:30:00.000Z")).toBe("29 Mar 2026, 02:30");
    expect(formatShopDateTime("2026-10-25T00:30:00.000Z")).toBe("25 Oct 2026, 01:30");
    expect(formatShopDateTime("2026-10-25T01:30:00.000Z")).toBe("25 Oct 2026, 01:30");
    expect(formatShopDate("2026-06-30T23:30:00.000Z")).toBe("1 Jul 2026");
    expect(formatShopDate("2026-09-15T12:00:00.000Z")).toBe("15 Sep 2026");
  });
});
