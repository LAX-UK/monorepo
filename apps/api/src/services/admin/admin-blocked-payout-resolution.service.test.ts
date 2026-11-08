import { describe, expect, it, vi } from "vitest";
import { PayoutNotFoundError, PayoutStatusTransitionError } from "../interfaces/payout.js";
import { AdminBlockedPayoutResolutionService } from "./admin-blocked-payout-resolution.service.js";

const blocked = { id: "payout-1", status: "transfer_blocked", legalEntityId: "entity-1" };
const REASON = "Checked Stripe: tr_ok is the live transfer";

type Options = {
  found?: unknown;
  linked?: unknown;
  verification?: unknown;
  adoptError?: Error;
};

function setup(options: Options = {}) {
  const payouts = {
    adoptBlockedTransfer: vi.fn(async () => {
      if (options.adoptError) throw options.adoptError;
      return { ...blocked, status: "in_transit" };
    }),
    releaseBlockedPayout: vi.fn(async () => ({ ...blocked, status: "failed" })),
  };
  const repo = {
    findById: vi.fn().mockResolvedValue("found" in options ? options.found : blocked),
    findByStripeTransferId: vi.fn().mockResolvedValue(options.linked ?? null),
  };
  const transfers = {
    verifyTransferForAdoption: vi
      .fn()
      .mockResolvedValue(options.verification ?? { ok: true, stripeTransferId: "tr_ok" }),
  };
  const service = new AdminBlockedPayoutResolutionService(payouts as never, repo, transfers);
  return { service, payouts, repo, transfers };
}

const adopt = { resolution: "adopt_transfer", stripeTransferId: "tr_ok", reason: REASON } as const;
const release = {
  resolution: "release_to_failed",
  noLiveTransferConfirmed: true,
  reason: REASON,
} as const;

describe("AdminBlockedPayoutResolutionService", () => {
  describe("adopt a transfer", () => {
    it("moves the payout once Stripe's transfer passes every check", async () => {
      const { service, payouts, transfers } = setup();

      const outcome = await service.resolve("staff-1", "payout-1", adopt);

      expect(outcome).toMatchObject({ ok: true, payout: { status: "in_transit" } });
      expect(transfers.verifyTransferForAdoption).toHaveBeenCalledWith("payout-1", "tr_ok");
      expect(payouts.adoptBlockedTransfer).toHaveBeenCalledWith("staff-1", "payout-1", {
        stripeTransferId: "tr_ok",
        reason: REASON,
      });
    });

    it.each([
      ["transfer_not_found", "Stripe has no transfer with that ID."],
      [
        "transfer_reversed",
        "That transfer has been reversed, in whole or in part, so it cannot be used.",
      ],
      [
        "destination_mismatch",
        "That transfer went to a different Stripe account than this seller's.",
      ],
      ["currency_mismatch", "That transfer is in a different currency from the payout."],
      ["amount_mismatch", "That transfer's amount is not the payout's net amount."],
      ["stripe_error", "Stripe could not be reached to check that transfer. Try again."],
    ])("refuses with a clear reason when Stripe says %s", async (reason, message) => {
      const { service, payouts } = setup({ verification: { ok: false, reason } });

      await expect(service.resolve("staff-1", "payout-1", adopt)).resolves.toEqual({
        ok: false,
        reason,
        message,
      });
      expect(payouts.adoptBlockedTransfer).not.toHaveBeenCalled();
    });

    it("refuses a transfer already linked to another payout, without asking Stripe", async () => {
      const { service, payouts, transfers } = setup({ linked: { id: "payout-2" } });

      await expect(service.resolve("staff-1", "payout-1", adopt)).resolves.toEqual({
        ok: false,
        reason: "transfer_linked_to_other_payout",
        message: "That Stripe transfer is already linked to another payout.",
      });
      expect(transfers.verifyTransferForAdoption).not.toHaveBeenCalled();
      expect(payouts.adoptBlockedTransfer).not.toHaveBeenCalled();
    });

    it("loses the race cleanly when the payout moved while Stripe was being asked", async () => {
      const { service } = setup({
        adoptError: new PayoutStatusTransitionError("payout_state_changed"),
      });

      await expect(service.resolve("staff-1", "payout-1", adopt)).rejects.toMatchObject({
        code: "payout_state_changed",
      });
    });
  });

  describe("release to failed", () => {
    it("moves the payout with the confirmation and reason, asking Stripe nothing", async () => {
      const { service, payouts, transfers } = setup();

      const outcome = await service.resolve("staff-1", "payout-1", release);

      expect(outcome).toMatchObject({ ok: true, payout: { status: "failed" } });
      expect(payouts.releaseBlockedPayout).toHaveBeenCalledWith("staff-1", "payout-1", {
        reason: REASON,
        noLiveTransferConfirmed: true,
      });
      expect(transfers.verifyTransferForAdoption).not.toHaveBeenCalled();
    });

    it("loses the race cleanly when the payout moved first", async () => {
      const { service, payouts } = setup();
      payouts.releaseBlockedPayout.mockRejectedValue(
        new PayoutStatusTransitionError("payout_state_changed"),
      );

      await expect(service.resolve("staff-1", "payout-1", release)).rejects.toMatchObject({
        code: "payout_state_changed",
      });
    });
  });

  it.each(["scheduled", "in_transit", "failed", "paid", "reversed", "clawback_pending"])(
    "refuses either resolution for a %s payout",
    async (status) => {
      for (const input of [adopt, release]) {
        const { service, payouts, transfers } = setup({ found: { ...blocked, status } });

        await expect(service.resolve("staff-1", "payout-1", input)).rejects.toMatchObject({
          code: "payout_not_blocked",
        });
        expect(payouts.adoptBlockedTransfer).not.toHaveBeenCalled();
        expect(payouts.releaseBlockedPayout).not.toHaveBeenCalled();
        expect(transfers.verifyTransferForAdoption).not.toHaveBeenCalled();
      }
    },
  );

  it("reports an unknown payout", async () => {
    const { service } = setup({ found: null });
    await expect(service.resolve("staff-1", "nope", release)).rejects.toBeInstanceOf(
      PayoutNotFoundError,
    );
  });
});
