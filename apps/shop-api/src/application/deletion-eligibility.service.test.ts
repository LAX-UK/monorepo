import { deletionBlockerSchema } from "@auction/identity-contracts";
import { describe, expect, it, vi } from "vitest";
import {
  SHOP_DELETION_BLOCKER_CODES,
  createShopDeletionEligibilityService,
} from "./deletion-eligibility.service.js";
import type { ShopDeletionOpenItems } from "./ports/deletion-eligibility.reader.js";

const NONE: ShopDeletionOpenItems = {
  openOrders: 0,
  pendingPayouts: 0,
  openOriginalSales: 0,
  activeHolds: 0,
};

function service(
  open: Partial<ShopDeletionOpenItems>,
  origins = { shop: "https://shop.example", art: "https://art.example" },
) {
  const reader = { readOpenItems: vi.fn(async () => ({ ...NONE, ...open })) };
  return { reader, service: createShopDeletionEligibilityService({ reader, origins }) };
}

describe("shop deletion eligibility service", () => {
  it("has no blockers for a person with nothing in flight", async () => {
    const { service: s, reader } = service({});
    expect(await s.listBlockers("subject-1")).toEqual([]);
    expect(reader.readOpenItems).toHaveBeenCalledWith("subject-1");
  });

  it("names open orders and links to the Shop orders page", async () => {
    const [blocker] = await service({ openOrders: 2 }).service.listBlockers("s");
    expect(blocker).toEqual({
      code: SHOP_DELETION_BLOCKER_CODES.openOrders,
      message: "You have 2 orders that haven't been paid for or delivered yet.",
      href: "https://shop.example/account/orders",
    });
  });

  it("names pending payouts and links to lax.art payouts", async () => {
    const [blocker] = await service({ pendingPayouts: 1 }).service.listBlockers("s");
    expect(blocker).toEqual({
      code: SHOP_DELETION_BLOCKER_CODES.pendingPayouts,
      message: "1 payout to you hasn't been paid yet. It needs to arrive first.",
      href: "https://art.example/account/payouts",
    });
  });

  it("names open original sales and held works, both pointing at enquiries", async () => {
    const blockers = await service({ openOriginalSales: 1, activeHolds: 3 }).service.listBlockers(
      "s",
    );
    expect(blockers.map((blocker) => blocker.code)).toEqual([
      "shop_open_original_sales",
      "shop_active_holds",
    ]);
    expect(blockers[0]?.message).toContain("1 original work reserved");
    expect(blockers[1]?.message).toContain("3 works are being held for you");
    expect(blockers.map((blocker) => blocker.href)).toEqual([
      "https://art.example/account/enquiries",
      "https://art.example/account/enquiries",
    ]);
  });

  it("lists every blocker, in a stable order", async () => {
    const blockers = await service({
      openOrders: 1,
      pendingPayouts: 1,
      openOriginalSales: 1,
      activeHolds: 1,
    }).service.listBlockers("s");
    expect(blockers.map((blocker) => blocker.code)).toEqual([
      "shop_open_orders",
      "shop_pending_payouts",
      "shop_open_original_sales",
      "shop_active_holds",
    ]);
  });

  it("falls back to the Shop origin for lax.art pages when no separate art origin is set", async () => {
    const shop = "https://shop.example";
    const [blocker] = await service(
      { pendingPayouts: 1 },
      { shop, art: shop },
    ).service.listBlockers("s");
    expect(blocker?.href).toBe("https://shop.example/account/payouts");
  });

  it("answers in the shared contract's shape, with whole sentences", async () => {
    const blockers = await service({
      openOrders: 5,
      pendingPayouts: 5,
      openOriginalSales: 5,
      activeHolds: 5,
    }).service.listBlockers("s");
    for (const blocker of blockers) {
      expect(deletionBlockerSchema.safeParse(blocker).success).toBe(true);
      expect(blocker.message).toMatch(/^[A-Z0-9]/);
      expect(blocker.message).toMatch(/\.$/);
    }
  });

  it("lets a reader failure propagate, so it is never mistaken for 'nothing in the way'", async () => {
    const { service: s, reader } = service({});
    reader.readOpenItems.mockRejectedValueOnce(new Error("database down"));
    await expect(s.listBlockers("s")).rejects.toThrow("database down");
  });
});
