import { describe, expect, it } from "vitest";
import { toSaleCardTimingVM, toSaleCountdownEndIso } from "./sale-timing.js";

describe("toSaleCardTimingVM", () => {
  it("normalizes sale timing fields", () => {
    expect(
      toSaleCardTimingVM({
        status: "scheduled",
        startTime: "2026-01-01T00:00:00.000Z",
        endTime: new Date("2026-01-02T00:00:00.000Z"),
      }),
    ).toEqual({
      status: "scheduled",
      startTime: "2026-01-01T00:00:00.000Z",
      endTime: "2026-01-02T00:00:00.000Z",
    });
  });
});

describe("toSaleCountdownEndIso", () => {
  it("returns undefined unless the sale is active", () => {
    expect(toSaleCountdownEndIso({ status: "active", endTime: "2026-01-02T00:00:00.000Z" })).toBe(
      "2026-01-02T00:00:00.000Z",
    );
    expect(
      toSaleCountdownEndIso({ status: "ended", endTime: "2026-01-02T00:00:00.000Z" }),
    ).toBeUndefined();
  });
});
