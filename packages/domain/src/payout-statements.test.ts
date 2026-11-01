import { describe, expect, it } from "vitest";
import { compareStatementsNewestFirst, statementAvailability } from "./payout-statements.js";

describe("statementAvailability", () => {
  it("is ready once the PDF is kept", () => {
    expect(
      statementAvailability({ statementUrl: "https://x/s.pdf", statementGenerationError: null }),
    ).toBe("ready");
  });

  it("is made on request before anyone asked for it", () => {
    expect(statementAvailability({ statementUrl: null, statementGenerationError: null })).toBe(
      "on_request",
    );
  });

  it("is unavailable when it could not be made, even with an older copy", () => {
    expect(
      statementAvailability({ statementUrl: "https://x/s.pdf", statementGenerationError: "boom" }),
    ).toBe("unavailable");
  });
});

describe("compareStatementsNewestFirst", () => {
  it("orders by period end, then by when the payout was made", () => {
    const at = (iso: string) => new Date(iso);
    const rows = [
      { id: "a", periodEnd: at("2026-09-30"), createdAt: at("2026-10-01") },
      { id: "b", periodEnd: at("2026-10-31"), createdAt: at("2026-11-01") },
      { id: "c", periodEnd: at("2026-10-31"), createdAt: at("2026-11-02") },
    ];
    expect([...rows].sort(compareStatementsNewestFirst).map((r) => r.id)).toEqual(["c", "b", "a"]);
  });
});
