import { deletionBlockerSchema } from "@auction/identity-contracts";
import { describe, expect, it, vi } from "vitest";
import {
  AccountDeletionEligibilityService,
  BID_DELETION_BLOCKER_CODES,
} from "./account-deletion-eligibility.service.js";

function setup(
  reader: Partial<{
    hasPendingPayment: boolean;
    hasActiveSellerLot: boolean;
    entityIds: string[];
    hasOpenPayout: boolean;
  }> = {},
) {
  const readers = {
    hasPendingPayment: vi.fn(async () => reader.hasPendingPayment ?? false),
    hasActiveSellerLot: vi.fn(async () => reader.hasActiveSellerLot ?? false),
    listActiveMembershipEntityIds: vi.fn(async () => reader.entityIds ?? []),
    hasOpenPayoutForEntities: vi.fn(async () => reader.hasOpenPayout ?? false),
  };
  return {
    readers,
    service: new AccountDeletionEligibilityService(readers, "https://bid.example"),
  };
}

describe("AccountDeletionEligibilityService", () => {
  it("has no blockers for a person with nothing in flight", async () => {
    expect(await setup().service.listBlockers("u1")).toEqual([]);
  });

  it("names an unpaid payment and links to the payments page", async () => {
    const blockers = await setup({ hasPendingPayment: true }).service.listBlockers("u1");
    expect(blockers).toEqual([
      {
        code: BID_DELETION_BLOCKER_CODES.pendingPayments,
        message: expect.stringContaining("payment"),
        href: "https://bid.example/dashboard/payments",
      },
    ]);
  });

  it("names active seller lots and links to the in-sale page", async () => {
    const [blocker] = await setup({ hasActiveSellerLot: true }).service.listBlockers("u1");
    expect(blocker?.code).toBe(BID_DELETION_BLOCKER_CODES.activeSellerLots);
    expect(blocker?.href).toBe("https://bid.example/dashboard/seller/in-sale");
  });

  it("looks for open payouts across the organisations the person belongs to", async () => {
    const { service, readers } = setup({ entityIds: ["e1", "e2"], hasOpenPayout: true });
    const [blocker] = await service.listBlockers("u1");
    expect(readers.hasOpenPayoutForEntities).toHaveBeenCalledWith(["e1", "e2"]);
    expect(blocker?.code).toBe(BID_DELETION_BLOCKER_CODES.openPayouts);
    expect(blocker?.href).toBe("https://bid.example/dashboard/seller/payouts");
  });

  it("lists every blocker, not just the first", async () => {
    const blockers = await setup({
      hasPendingPayment: true,
      hasActiveSellerLot: true,
      hasOpenPayout: true,
    }).service.listBlockers("u1");
    expect(blockers.map((blocker) => blocker.code)).toEqual([
      "account_deletion_pending_payments",
      "account_deletion_active_seller_lots",
      "account_deletion_open_payouts",
    ]);
  });

  it("answers in the shared contract's shape, in British English with sentence-case copy", async () => {
    const blockers = await setup({
      hasPendingPayment: true,
      hasActiveSellerLot: true,
      hasOpenPayout: true,
    }).service.listBlockers("u1");
    for (const blocker of blockers) {
      expect(deletionBlockerSchema.safeParse(blocker).success).toBe(true);
      expect(blocker.message).toMatch(/^[A-Z]/);
      expect(blocker.message).toMatch(/\.$/);
    }
  });

  it("lets a reader failure propagate, so it is never mistaken for 'nothing in the way'", async () => {
    const { service, readers } = setup();
    readers.hasPendingPayment.mockRejectedValueOnce(new Error("database down"));
    await expect(service.listBlockers("u1")).rejects.toThrow("database down");
  });
});
