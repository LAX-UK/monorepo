import { describe, expect, it } from "vitest";
import { isoDate, isoDateOrNull } from "./iso-date";

describe("isoDate", () => {
  it("accepts a Date or the string the API sends", () => {
    const iso = "2026-10-26T09:06:33.000Z";
    expect(isoDate(new Date(iso))).toBe(iso);
    expect(isoDate(iso)).toBe(iso);
  });

  it("keeps a missing value missing", () => {
    expect(isoDateOrNull(null)).toBeNull();
    expect(isoDateOrNull(undefined)).toBeNull();
    expect(isoDateOrNull("2026-10-26T09:06:33.000Z")).toBe("2026-10-26T09:06:33.000Z");
  });
});
