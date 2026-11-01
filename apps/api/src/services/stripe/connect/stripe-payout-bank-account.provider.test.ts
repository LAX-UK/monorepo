import { describe, expect, it, vi } from "vitest";
import {
  StripePayoutBankAccountProvider,
  pickPayoutBankAccount,
} from "./stripe-payout-bank-account.provider.js";

const bank = (fields: Record<string, unknown>) => ({
  object: "bank_account",
  bank_name: "BARCLAYS BANK PLC",
  last4: "0042",
  account_holder_name: "Northbank Gallery Ltd",
  currency: "gbp",
  status: "new",
  routing_number: "20-00-00",
  fingerprint: "fp_secret",
  ...fields,
});

describe("pickPayoutBankAccount", () => {
  it("prefers the default account for its currency", () => {
    expect(
      pickPayoutBankAccount([bank({ last4: "1111" }), bank({ default_for_currency: true })]),
    ).toMatchObject({ last4: "0042" });
  });

  it("copies only the summary fields, never the sort code or fingerprint", () => {
    const picked = pickPayoutBankAccount([bank({})]);
    expect(picked).toEqual({
      bankName: "BARCLAYS BANK PLC",
      last4: "0042",
      accountHolderName: "Northbank Gallery Ltd",
      currency: "gbp",
      providerStatus: "new",
    });
  });

  it("ignores cards and returns null with no bank account", () => {
    expect(pickPayoutBankAccount([{ object: "card", last4: "4242" }])).toBeNull();
    expect(pickPayoutBankAccount([])).toBeNull();
  });
});

describe("StripePayoutBankAccountProvider", () => {
  it("lists the connected account's bank accounts", async () => {
    const listExternalAccounts = vi.fn(async () => ({ data: [bank({})] }));
    const provider = new StripePayoutBankAccountProvider({
      get: () => ({ accounts: { listExternalAccounts } }) as never,
      require: vi.fn(),
    });
    expect(await provider.defaultBankAccount("acct_1")).toMatchObject({ last4: "0042" });
    expect(listExternalAccounts).toHaveBeenCalledWith("acct_1", {
      object: "bank_account",
      limit: 10,
    });
  });

  it("throws when Stripe is not configured, so the service reports it as unavailable", async () => {
    const provider = new StripePayoutBankAccountProvider({ get: () => null, require: vi.fn() });
    await expect(provider.defaultBankAccount("acct_1")).rejects.toThrow();
  });
});
