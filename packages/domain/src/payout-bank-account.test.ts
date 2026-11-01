import { describe, expect, it } from "vitest";
import { payoutBankAccountSummary } from "./payout-bank-account.js";

const account = {
  bankName: "BARCLAYS BANK PLC",
  last4: "0042",
  accountHolderName: "Northbank Gallery Ltd",
  currency: "gbp",
  providerStatus: "verified",
};

describe("payoutBankAccountSummary", () => {
  it("keeps the bank, last four digits, holder and currency", () => {
    expect(payoutBankAccountSummary(account)).toEqual({
      bankName: "BARCLAYS BANK PLC",
      last4: "0042",
      accountHolderName: "Northbank Gallery Ltd",
      currency: "GBP",
      status: "ready",
    });
  });

  it("never passes on more than four digits", () => {
    expect(payoutBankAccountSummary({ ...account, last4: "31926819" }).last4).toBeNull();
    expect(payoutBankAccountSummary({ ...account, last4: "12-34" }).last4).toBeNull();
  });

  it.each(["new", "validated", "verified", null])("reads %s as ready", (providerStatus) => {
    expect(payoutBankAccountSummary({ ...account, providerStatus }).status).toBe("ready");
  });

  it.each(["errored", "verification_failed"])("reads %s as failed", (providerStatus) => {
    expect(payoutBankAccountSummary({ ...account, providerStatus }).status).toBe("failed");
  });

  it("turns blank values into null", () => {
    const summary = payoutBankAccountSummary({
      bankName: " ",
      last4: null,
      accountHolderName: "",
      currency: null,
      providerStatus: "new",
    });
    expect(summary).toEqual({
      bankName: null,
      last4: null,
      accountHolderName: null,
      currency: null,
      status: "ready",
    });
  });
});
