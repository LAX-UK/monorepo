import { describe, expect, it } from "vitest";
import { formatOgDateTime } from "./og-date-format";

describe("formatOgDateTime", () => {
  it("formats in en-GB with Europe/London timezone", () => {
    const formatted = formatOgDateTime(new Date("2026-06-18T14:30:00.000Z"));
    expect(formatted).toMatch(/18 June 2026/);
    expect(formatted).toMatch(/\d{1,2}:\d{2}/);
  });
});
