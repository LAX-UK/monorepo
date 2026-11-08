import StripeSdk from "stripe";
import { describe, expect, it, vi } from "vitest";
import { ConnectTransferInitiationService } from "./connect-transfer-initiation.service.js";

const payout = {
  id: "payout-1",
  legalEntityId: "entity-1",
  netAmount: "480.00",
  currency: "GBP",
  status: "transfer_blocked",
  createdAt: new Date("2026-10-01T00:00:00Z"),
};

const goodTransfer = {
  id: "tr_ok",
  destination: "acct_1",
  currency: "gbp",
  amount: 48_000,
  amount_reversed: 0,
  reversed: false,
  transfer_group: "payout:payout-1",
};

function setup(
  options: {
    retrieve?: ReturnType<typeof vi.fn>;
    stripe?: unknown;
    payout?: unknown;
    account?: string | null;
  } = {},
) {
  const retrieve = options.retrieve ?? vi.fn().mockResolvedValue(goodTransfer);
  const stripe = "stripe" in options ? options.stripe : { transfers: { retrieve } };
  const updateStatusIfCurrent = vi.fn();
  const service = new ConnectTransferInitiationService(
    { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
    {
      findLegalEntityById: vi.fn().mockResolvedValue({
        stripeConnectAccountId: "account" in options ? options.account : "acct_1",
      }),
      findStripeChargeIdByPaymentId: vi.fn(),
    } as never,
    { get: () => stripe } as never,
    { syncAccountFromStripe: vi.fn() } as never,
    {
      findById: vi.fn().mockResolvedValue("payout" in options ? options.payout : payout),
      updateStatusIfCurrent,
    } as never,
  );
  return { service, retrieve, updateStatusIfCurrent };
}

describe("ConnectTransferInitiationService.verifyTransferForAdoption", () => {
  it("accepts a live transfer to the seller's account for the payout's amount", async () => {
    const { service, retrieve, updateStatusIfCurrent } = setup();

    await expect(service.verifyTransferForAdoption("payout-1", "tr_ok")).resolves.toEqual({
      ok: true,
      stripeTransferId: "tr_ok",
    });
    expect(retrieve).toHaveBeenCalledWith("tr_ok");
    expect(updateStatusIfCurrent).not.toHaveBeenCalled();
  });

  it.each([
    ["another account", { destination: "acct_other" }, "destination_mismatch"],
    ["another currency", { currency: "usd" }, "currency_mismatch"],
    ["a different amount", { amount: 47_999 }, "amount_mismatch"],
    ["reversed", { reversed: true }, "transfer_reversed"],
    ["partly reversed", { amount_reversed: 1 }, "transfer_reversed"],
  ])("refuses a transfer to %s", async (_name, over, reason) => {
    const { service } = setup({
      retrieve: vi.fn().mockResolvedValue({ ...goodTransfer, ...over }),
    });
    await expect(service.verifyTransferForAdoption("payout-1", "tr_ok")).resolves.toEqual({
      ok: false,
      reason,
    });
  });

  it("refuses a transfer Stripe records against another payout", async () => {
    const { service, updateStatusIfCurrent } = setup({
      retrieve: vi.fn().mockResolvedValue({ ...goodTransfer, transfer_group: "payout:payout-2" }),
    });
    await expect(service.verifyTransferForAdoption("payout-1", "tr_ok")).resolves.toEqual({
      ok: false,
      reason: "transfer_belongs_to_other_payout",
    });
    expect(updateStatusIfCurrent).not.toHaveBeenCalled();
  });

  it("reports a transfer Stripe does not know", async () => {
    const missing = new StripeSdk.errors.StripeInvalidRequestError({
      type: "invalid_request_error",
      code: "resource_missing",
      message: "No such transfer",
    });
    const { service } = setup({ retrieve: vi.fn().mockRejectedValue(missing) });
    await expect(service.verifyTransferForAdoption("payout-1", "tr_nope")).resolves.toEqual({
      ok: false,
      reason: "transfer_not_found",
    });
  });

  it("reports another Stripe error without adopting", async () => {
    // A rejected request, not retried by the Stripe retry wrapper.
    const down = new StripeSdk.errors.StripePermissionError({
      type: "invalid_request_error",
      message: "No access",
    });
    const { service } = setup({ retrieve: vi.fn().mockRejectedValue(down) });
    await expect(service.verifyTransferForAdoption("payout-1", "tr_ok")).resolves.toEqual({
      ok: false,
      reason: "stripe_error",
    });
  });

  it("refuses when Stripe is not configured, the payout is unknown or the seller has no account", async () => {
    await expect(
      setup({ stripe: null }).service.verifyTransferForAdoption("payout-1", "tr_ok"),
    ).resolves.toEqual({ ok: false, reason: "stripe_not_configured" });
    await expect(
      setup({ payout: null }).service.verifyTransferForAdoption("payout-1", "tr_ok"),
    ).resolves.toEqual({ ok: false, reason: "payout_not_found" });
    await expect(
      setup({ account: null }).service.verifyTransferForAdoption("payout-1", "tr_ok"),
    ).resolves.toEqual({ ok: false, reason: "no_connect_account" });
  });
});
