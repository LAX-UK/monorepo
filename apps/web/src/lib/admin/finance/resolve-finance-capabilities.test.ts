import { describe, expect, it } from "vitest";
import { resolveFinanceCapabilities } from "./resolve-finance-capabilities";

describe("resolveFinanceCapabilities", () => {
  it("grants finance staff payment and payout mutation", () => {
    expect(
      resolveFinanceCapabilities({ role: "staff", staffRole: "finance_ops" }).canMutatePayments,
    ).toBe(true);
  });

  it("denies client users", () => {
    expect(resolveFinanceCapabilities({ role: "client", staffRole: null }).canAccessFinance).toBe(
      false,
    );
  });
});
