import { describe, expect, it } from "vitest";
import { payoutStatementHref, payoutStatementUnavailableHref } from "./payout-statement-links";

describe("payout statement links", () => {
  it("addresses the statement and its failure page by entity and payout", () => {
    expect(payoutStatementHref("le-1", "p-1")).toBe("/legal-entities/le-1/payouts/p-1/statement");
    expect(payoutStatementUnavailableHref("le-1", "p-1")).toBe(
      "/legal-entities/le-1/payouts/p-1/statement/unavailable",
    );
  });

  it("encodes ids", () => {
    expect(payoutStatementHref("a/b", "c d")).toBe("/legal-entities/a%2Fb/payouts/c%20d/statement");
  });
});
