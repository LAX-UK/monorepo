import { describe, expect, it } from "vitest";
import { formatAdminDetailDateTime, formatAdminDetailGbpPence } from "./admin-detail-format";

describe("formatAdminDetailDateTime", () => {
  it("shows London time, one hour ahead of UTC in summer", () => {
    expect(formatAdminDetailDateTime("2026-07-01T10:30:00.000Z")).toBe("1 Jul 2026, 11:30");
  });

  it("shows UTC time in winter", () => {
    expect(formatAdminDetailDateTime("2026-01-15T10:30:00.000Z")).toBe("15 Jan 2026, 10:30");
  });

  it("returns text that is not a date unchanged", () => {
    expect(formatAdminDetailDateTime("not a date")).toBe("not a date");
  });
});

describe("formatAdminDetailGbpPence", () => {
  it("formats pence as pounds", () => {
    expect(formatAdminDetailGbpPence(120050)).toBe("£1,200.50");
  });
});
