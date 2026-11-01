import { payoutBankAccountSummary } from "@auction/domain";
import { describe, expect, it } from "vitest";
import { SamplePayoutBankAccountProvider } from "./sample-payout-bank-account.provider.js";

describe("SamplePayoutBankAccountProvider", () => {
  it("gives a ready sample account that passes the client-safe summary", async () => {
    const account = await new SamplePayoutBankAccountProvider().defaultBankAccount("acct_any");
    expect(account && payoutBankAccountSummary(account)).toEqual({
      bankName: "BARCLAYS BANK PLC",
      last4: "0042",
      accountHolderName: "Sample Account Holder",
      currency: "GBP",
      status: "ready",
    });
  });
});
