import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { findLotsMissingSellerConnect, isSellerConnectReady } from "./seller-connect-readiness.js";

describe("isSellerConnectReady", () => {
  it("requires approved status, payouts enabled, and no due requirements", () => {
    expect(
      isSellerConnectReady({
        status: "approved",
        stripeConnectPayoutsEnabled: true,
        stripeConnectRequirementsCurrentlyDue: [],
      }),
    ).toBe(true);
    expect(
      isSellerConnectReady({
        status: "pending",
        stripeConnectPayoutsEnabled: true,
        stripeConnectRequirementsCurrentlyDue: [],
      }),
    ).toBe(false);
  });
});

describe("findLotsMissingSellerConnect", () => {
  it("returns lots with missing or not-ready sellers", async () => {
    const findById = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
      status: "approved",
      stripeConnectPayoutsEnabled: false,
      stripeConnectRequirementsCurrentlyDue: [],
    });
    const repo = { findById } as unknown as ILegalEntityRepository;

    const blocked = await findLotsMissingSellerConnect(
      [
        { id: "lot-1", title: "One", sellerLegalEntityId: "seller-a" },
        { id: "lot-2", title: "Two", sellerLegalEntityId: "seller-b" },
        { id: "lot-3", title: "Three", sellerLegalEntityId: null },
      ],
      repo,
    );

    expect(blocked.map((l) => l.id)).toEqual(["lot-1", "lot-2"]);
    expect(findById).toHaveBeenCalledTimes(2);
  });

  it("deduplicates seller lookups", async () => {
    const findById = vi.fn().mockResolvedValue({
      status: "approved",
      stripeConnectPayoutsEnabled: false,
      stripeConnectRequirementsCurrentlyDue: [],
    });
    const repo = { findById } as unknown as ILegalEntityRepository;

    await findLotsMissingSellerConnect(
      [
        { id: "lot-1", title: "One", sellerLegalEntityId: "seller-a" },
        { id: "lot-2", title: "Two", sellerLegalEntityId: "seller-a" },
      ],
      repo,
    );

    expect(findById).toHaveBeenCalledTimes(1);
  });

  it("skips LAX-managed sellers", async () => {
    const findById = vi.fn().mockResolvedValue({
      status: "approved",
      stripeConnectPayoutsEnabled: false,
      stripeConnectRequirementsCurrentlyDue: [],
      isLaxManaged: true,
    });
    const repo = { findById } as unknown as ILegalEntityRepository;

    const blocked = await findLotsMissingSellerConnect(
      [{ id: "lot-1", title: "One", sellerLegalEntityId: "seller-a" }],
      repo,
    );

    expect(blocked).toEqual([]);
  });
});
