import { describe, expect, it } from "vitest";
import {
  bankNameLabel,
  payoutBankLine,
  payoutBankLineWithCurrency,
} from "./payout-bank-account.vm";

const account = {
  bankName: "BARCLAYS BANK PLC",
  last4: "0042",
  accountHolderName: "Northbank Gallery Ltd",
  currency: "GBP",
  status: "ready" as const,
};

describe("bankNameLabel", () => {
  it("title-cases a name in capitals, keeping known acronyms", () => {
    expect(bankNameLabel("BARCLAYS BANK PLC")).toBe("Barclays Bank PLC");
    expect(bankNameLabel("HSBC UK BANK PLC")).toBe("HSBC UK Bank PLC");
  });

  it("leaves a mixed-case name as the bank wrote it", () => {
    expect(bankNameLabel("NatWest")).toBe("NatWest");
  });
});

describe("payoutBankLine", () => {
  it("names the bank and the last four digits", () => {
    expect(payoutBankLine(account)).toBe("Barclays Bank PLC ending 0042");
    expect(payoutBankLineWithCurrency(account)).toBe("Barclays Bank PLC ending 0042 · GBP");
  });

  it("reads well with a part missing", () => {
    expect(payoutBankLine({ ...account, bankName: null })).toBe("Account ending 0042");
    expect(payoutBankLine({ ...account, last4: null })).toBe("Barclays Bank PLC");
    expect(payoutBankLine({ ...account, bankName: null, last4: null })).toBe("Bank account");
    expect(payoutBankLineWithCurrency({ ...account, currency: null })).toBe(
      "Barclays Bank PLC ending 0042",
    );
  });
});
