import { describe, expect, it } from "vitest";
import {
  formatPayoutReference,
  parsePayoutReference,
  parsePayoutSearch,
} from "./payout-reference.js";

const id = "3fa9c1d2-7b44-4e0a-9d51-aa11bb22cc33";

describe("formatPayoutReference", () => {
  it("reads as PO, the year the period ends, and eight id characters", () => {
    expect(formatPayoutReference({ id, periodEnd: new Date("2026-06-30T00:00:00Z") })).toBe(
      "PO-2026-3FA9C1D2",
    );
  });

  it("uses the UTC year, so a period ending at midnight keeps its year", () => {
    expect(formatPayoutReference({ id, periodEnd: new Date("2026-12-31T23:59:59Z") })).toBe(
      "PO-2026-3FA9C1D2",
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
    expect(formatPayoutReference({ id, periodEnd: new Date("nope") })).toBe("PO-0000-3FA9C1D2");
  });
});

describe("parsePayoutReference", () => {
  it("reads the year and id prefix back from a formatted reference", () => {
    const reference = formatPayoutReference({ id, periodEnd: new Date("2026-06-30T00:00:00Z") });
    expect(parsePayoutReference(reference)).toEqual({ year: 2026, idPrefix: "3fa9c1d2" });
  });

  it("accepts lower case, surrounding space and the earlier six-character form", () => {
    expect(parsePayoutReference("  po-2025-3fa9c1 ")).toEqual({ year: 2025, idPrefix: "3fa9c1" });
  });

  it.each([
    "",
    "3FA9C1D2",
    "PO-26-3FA9C1D2",
    "PO-2026-3FA",
    "PO-2026-3FA9C1D2E",
    "PO-2026-ZZZZZZZZ",
  ])("rejects %j", (text) => {
    expect(parsePayoutReference(text)).toBeNull();
  });
});

describe("parsePayoutSearch", () => {
  it("is null for an empty box", () => {
    expect(parsePayoutSearch("   ")).toBeNull();
  });

  it("matches a reference by year and id prefix", () => {
    expect(parsePayoutSearch("PO-2026-3FA9C1D2")).toEqual({
      kind: "reference",
      year: 2026,
      idPrefix: "3fa9c1d2",
    });
  });

  it("matches the start of an id", () => {
    expect(parsePayoutSearch("3FA9C1D2-7b44")).toEqual({ kind: "id", idPrefix: "3fa9c1d2-7b44" });
  });

  it("treats anything else as a seller name", () => {
    expect(parsePayoutSearch(" Gallery Ltd ")).toEqual({ kind: "text", text: "Gallery Ltd" });
  });
});
