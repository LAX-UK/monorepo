import { describe, expect, it, vi } from "vitest";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
import { PayoutService } from "../payout.service.js";

const blocked = {
  id: "po1",
  legalEntityId: "entity-1",
  status: "transfer_blocked",
  stripeTransferId: null,
  failureReason: "transfer_blocked: multiple_live_transfers (tr_a, tr_b)",
  processedAt: null,
  netAmount: "480.00",
  currency: "GBP",
};
const REASON = "Checked Stripe: tr_ok is the live transfer";

function setup(
  options: {
    found?: unknown;
    linked?: unknown;
    cas?: "wins" | "loses";
    current?: unknown;
  } = {},
) {
  const repo = {
    findById: vi
      .fn()
      .mockResolvedValueOnce("found" in options ? options.found : blocked)
      .mockResolvedValue(options.current ?? { ...blocked, status: "in_transit" }),
    findByStripeTransferId: vi.fn().mockResolvedValue(options.linked ?? null),
    updateStatusIfCurrent: vi.fn(async (_id: string, _from: string, patch: object) =>
      options.cas === "loses" ? null : { ...blocked, ...patch },
    ),
  };
  const publish = vi.fn().mockResolvedValue(undefined);
  const service = new PayoutService(
    repo as never,
    { runInTransaction: (fn) => fn({} as never) },
    mockDomainEventSink(publish),
    undefined,
    () => repo as never,
  );
  return { service, repo, publish };
}

describe("PayoutService.adoptBlockedTransfer", () => {
  it("moves a blocked payout to in_transit with the transfer, only if still blocked, and records the event", async () => {
    const { service, repo, publish } = setup();

    const result = await service.adoptBlockedTransfer("staff-1", "po1", {
      stripeTransferId: "tr_ok",
      reason: REASON,
    });

    expect(result.status).toBe("in_transit");
    expect(repo.updateStatusIfCurrent).toHaveBeenCalledWith("po1", "transfer_blocked", {
      status: "in_transit",
      stripeTransferId: "tr_ok",
      processedAt: null,
      failureReason: null,
    });
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateId: "po1",
        eventType: "payout.transfer_block_resolved",
        actorUserId: "staff-1",
        payload: expect.objectContaining({
          resolution: "adopt_transfer",
          previousStatus: "transfer_blocked",
          status: "in_transit",
          stripeTransferId: "tr_ok",
          reason: REASON,
        }),
      }),
    );
  });

  it("refuses a transfer another payout already holds, writing nothing", async () => {
    const { service, repo, publish } = setup({ linked: { id: "po2" } });

    await expect(
      service.adoptBlockedTransfer("staff-1", "po1", { stripeTransferId: "tr_ok", reason: REASON }),
    ).rejects.toMatchObject({ code: "transfer_linked_to_other_payout" });
    expect(repo.updateStatusIfCurrent).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it("accepts a transfer already recorded on this same payout", async () => {
    const { service } = setup({ linked: { id: "po1" } });
    await expect(
      service.adoptBlockedTransfer("staff-1", "po1", { stripeTransferId: "tr_ok", reason: REASON }),
    ).resolves.toMatchObject({ status: "in_transit" });
  });

  it("loses the race when the payout is no longer blocked, writing and publishing nothing", async () => {
    const { service, publish } = setup({
      cas: "loses",
      current: { ...blocked, status: "failed" },
    });

    await expect(
      service.adoptBlockedTransfer("staff-1", "po1", { stripeTransferId: "tr_ok", reason: REASON }),
    ).rejects.toMatchObject({ code: "payout_state_changed" });
    expect(publish).not.toHaveBeenCalled();
  });

  it.each(["scheduled", "in_transit", "failed", "paid"])(
    "refuses a %s payout before writing",
    async (status) => {
      const { service, repo } = setup({ found: { ...blocked, status } });
      await expect(
        service.adoptBlockedTransfer("staff-1", "po1", {
          stripeTransferId: "tr_ok",
          reason: REASON,
        }),
      ).rejects.toMatchObject({ code: "payout_not_blocked" });
      expect(repo.updateStatusIfCurrent).not.toHaveBeenCalled();
    },
  );

  it("reports an unknown payout", async () => {
    const { service } = setup({ found: null });
    await expect(
      service.adoptBlockedTransfer("staff-1", "po1", { stripeTransferId: "tr_ok", reason: REASON }),
    ).rejects.toMatchObject({ code: "payout_not_found" });
  });
});

describe("PayoutService.releaseBlockedPayout", () => {
  it("moves a blocked payout to failed, clears the transfer, and records the confirmation and reason", async () => {
    const { service, repo, publish } = setup();
    const before = Date.now();

    const result = await service.releaseBlockedPayout("staff-1", "po1", {
      reason: REASON,
      noLiveTransferConfirmed: true,
    });

    expect(result.status).toBe("failed");
    const [, from, patch] = repo.updateStatusIfCurrent.mock.calls[0] as unknown as [
      string,
      string,
      { status: string; stripeTransferId: null; processedAt: Date; failureReason: string },
    ];
    expect(from).toBe("transfer_blocked");
    expect(patch).toMatchObject({ status: "failed", stripeTransferId: null });
    expect(patch.processedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(patch.failureReason).toContain("multiple_live_transfers");
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "payout.transfer_block_resolved",
        actorUserId: "staff-1",
        payload: expect.objectContaining({
          resolution: "release_to_failed",
          previousStatus: "transfer_blocked",
          status: "failed",
          noLiveTransferConfirmed: true,
          reason: REASON,
        }),
      }),
    );
  });

  it("loses the race when the payout moved first, writing and publishing nothing", async () => {
    const { service, publish } = setup({
      cas: "loses",
      current: { ...blocked, status: "in_transit" },
    });

    await expect(
      service.releaseBlockedPayout("staff-1", "po1", {
        reason: REASON,
        noLiveTransferConfirmed: true,
      }),
    ).rejects.toMatchObject({ code: "payout_state_changed" });
    expect(publish).not.toHaveBeenCalled();
  });

  it.each(["scheduled", "in_transit", "failed", "paid"])(
    "refuses a %s payout before writing",
    async (status) => {
      const { service, repo } = setup({ found: { ...blocked, status } });
      await expect(
        service.releaseBlockedPayout("staff-1", "po1", {
          reason: REASON,
          noLiveTransferConfirmed: true,
        }),
      ).rejects.toMatchObject({ code: "payout_not_blocked" });
      expect(repo.updateStatusIfCurrent).not.toHaveBeenCalled();
    },
  );
});
