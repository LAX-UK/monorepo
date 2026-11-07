import { describe, expect, it } from "vitest";
import { formatPayoutReference } from "./payout-reference";

const id = "3fa9c1d2-7b44-4e0a-9d51-aa11bb22cc33";

describe("formatPayoutReference", () => {
  it("reads as PO, the year the period ends, and a short code", () => {
    expect(formatPayoutReference({ id, periodEnd: new Date("2026-06-30T00:00:00Z") })).toBe(
      "PO-2026-3FA9C1",
    );
  });

  it("uses the UTC year, so a period ending at midnight keeps its year", () => {
    expect(formatPayoutReference({ id, periodEnd: new Date("2026-12-31T23:59:59Z") })).toBe(
      "PO-2026-3FA9C1",
    );
  });

  it("is stable for the same payout and differs between payouts", () => {
    const periodEnd = new Date("2026-06-30T00:00:00Z");
    expect(formatPayoutReference({ id, periodEnd })).toBe(formatPayoutReference({ id, periodEnd }));
    expect(formatPayoutReference({ id: "b0c1d2e3-0000", periodEnd })).not.toBe(
      formatPayoutReference({ id, periodEnd }),
    );
  });

  it("does not fail on an unreadable date", () => {
    expect(formatPayoutReference({ id, periodEnd: new Date("nope") })).toBe("PO-0000-3FA9C1");
  });
});
