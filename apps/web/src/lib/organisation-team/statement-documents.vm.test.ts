import { describe, expect, it } from "vitest";
import { statementDocumentRows, statementPdfHref } from "./statement-documents.vm";

const statement = {
  kind: "payout" as const,
  payoutId: "p1",
  periodStart: "2026-10-01T00:00:00.000Z",
  periodEnd: "2026-10-31T00:00:00.000Z",
  netAmount: "12860.00",
  currency: "GBP",
  payoutStatus: "paid",
  issuedAt: "2026-11-01T09:00:00.000Z",
  availability: "on_request" as const,
};

describe("statementDocumentRows", () => {
  it("names the period and the amount, and links the PDF", () => {
    const [row] = statementDocumentRows("org-1", [statement]);
    expect(row?.title).toMatch(/^Payout statement · 1.Oct.2026 → 31.Oct.2026$/);
    expect(row?.detail).toBe("£12,860.00");
    expect(row?.href).toBe("/legal-entities/org-1/payouts/p1/statement");
    expect(row?.unavailable).toBe(false);
  });

  it("marks a statement that could not be made", () => {
    const [row] = statementDocumentRows("org-1", [{ ...statement, availability: "unavailable" }]);
    expect(row?.unavailable).toBe(true);
  });
});

describe("statementPdfHref", () => {
  it("escapes the ids", () => {
    expect(statementPdfHref("a/b", "c d")).toBe("/legal-entities/a%2Fb/payouts/c%20d/statement");
  });
});
