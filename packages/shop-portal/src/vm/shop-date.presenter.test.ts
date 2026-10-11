import { describe, expect, it } from "vitest";
import { formatShopDate, formatShopDateTime } from "./shop-date.presenter.js";

describe("shop date presenter", () => {
  it("formats dates in en-GB London timezone", () => {
    const iso = "2026-03-15T12:00:00.000Z";
    expect(formatShopDate(iso)).toMatch(/15 Mar 2026/);
    expect(formatShopDateTime(iso)).toMatch(/15 Mar 2026/);
  });
});
