import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { IPayoutBankAccountProvider } from "../interfaces/organisation-profile-service.js";
import { PayoutAccountService } from "./payout-account.service.js";

const ENTITY = "00000000-0000-4000-8000-000000000001";

const actor = (role: LegalEntityMemberRole) => ({ userId: "me", legalEntityId: ENTITY, role });

const BANK = {
  bankName: "BARCLAYS BANK PLC",
  last4: "0042",
  accountHolderName: "Northbank Gallery Ltd",
  currency: "gbp",
  providerStatus: "new",
};

function setup(input: {
  accountId?: string | null;
  bank?: IPayoutBankAccountProvider["defaultBankAccount"];
}) {
  const findLegalEntityRowById = vi.fn(async () =>
    input.accountId === undefined ? null : ({ stripeConnectAccountId: input.accountId } as never),
  );
  const defaultBankAccount = vi.fn(input.bank ?? (async () => BANK));
  const onProviderError = vi.fn();
  const service = new PayoutAccountService({
    connect: { findLegalEntityRowById },
    provider: { defaultBankAccount },
    onProviderError,
  });
  return { service, defaultBankAccount, onProviderError };
}

describe("PayoutAccountService", () => {
  it.each(["owner", "admin", "finance"] as const)("gives %s the summary only", async (role) => {
    const { service, defaultBankAccount } = setup({ accountId: "acct_1" });
    const view = (await service.view(actor(role)))._unsafeUnwrap();
    expect(defaultBankAccount).toHaveBeenCalledWith("acct_1");
    expect(view).toEqual({
      state: "ready",
      account: {
        bankName: "BARCLAYS BANK PLC",
        last4: "0042",
        accountHolderName: "Northbank Gallery Ltd",
        currency: "GBP",
        status: "ready",
      },
    });
  });

  it("is not set up without a payout account, and does not ask the provider", async () => {
    const { service, defaultBankAccount } = setup({ accountId: null });
    expect((await service.view(actor("owner")))._unsafeUnwrap()).toEqual({
      state: "not_set_up",
      account: null,
    });
    expect(defaultBankAccount).not.toHaveBeenCalled();
  });

  it("says when no bank account is added yet", async () => {
    const { service } = setup({ accountId: "acct_1", bank: async () => null });
    expect((await service.view(actor("admin")))._unsafeUnwrap().state).toBe("none");
  });

  it("reports the provider being unreachable instead of failing", async () => {
    const boom = new Error("stripe down");
    const { service, onProviderError } = setup({
      accountId: "acct_1",
      bank: async () => {
        throw boom;
      },
    });
    expect((await service.view(actor("finance")))._unsafeUnwrap()).toEqual({
      state: "unavailable",
      account: null,
    });
    expect(onProviderError).toHaveBeenCalledWith(boom, ENTITY);
  });

  it.each(["consignor", "buyer_agent", "viewer"] as const)("refuses %s", async (role) => {
    const { service, defaultBankAccount } = setup({ accountId: "acct_1" });
    expect((await service.view(actor(role)))._unsafeUnwrapErr().status).toBe(403);
    expect(defaultBankAccount).not.toHaveBeenCalled();
  });
});
