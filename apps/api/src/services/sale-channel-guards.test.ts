import {
  type AtgLotChannelState,
  type AtgRemoteStatus,
  type AtgSaleOwnershipSnapshot,
  type SaleStatus,
  resolveSaleSellingPlatform,
} from "@auction/types";
import { describe, expect, it } from "vitest";
import type { ISaleChannelReader } from "../repositories/interfaces/sale-channel.reader.js";
import {
  assertCanCancelSaleOnAtg,
  assertCanPublishOnLax,
  assertCanSoftDeleteSaleOnAtg,
  assertLotMovableOnAtg,
} from "./sale-channel-guards.js";

function ownership(
  saleStatus: SaleStatus,
  atgRemoteStatus: AtgRemoteStatus | null,
  atgSoldLotCount = 0,
): AtgSaleOwnershipSnapshot {
  const atgLinked = atgRemoteStatus != null;
  return {
    saleStatus,
    atgRemoteStatus,
    atgLinked,
    atgSoldLotCount,
    sellingPlatform: resolveSaleSellingPlatform({
      saleStatus,
      atgRemoteStatus,
      atgLinked,
      atgSoldLotCount,
    }),
    atgDistribution: "public_marketplace",
  };
}

function reader(
  sale: AtgSaleOwnershipSnapshot | null,
  lot: AtgLotChannelState = { linked: false, numberOfBids: 0, sold: false },
): ISaleChannelReader {
  return {
    getSaleOwnership: async () => sale,
    getSaleOwnerships: async () => new Map(sale ? [["s1", sale]] : []),
    getLotAtgState: async () => lot,
    getSoldLotIds: async () => new Set(),
  };
}

const live = ownership("draft", "published");
const closedWithSales = ownership("draft", "closed", 2);
const closedNoSales = ownership("draft", "closed", 0);

describe("assertCanPublishOnLax", () => {
  it("allows free sales and skips when no reader is wired", async () => {
    expect(await assertCanPublishOnLax(reader(ownership("draft", null)), "s1")).toBeNull();
    expect(await assertCanPublishOnLax(reader(closedNoSales), "s1")).toBeNull();
    expect(await assertCanPublishOnLax(null, "s1")).toBeNull();
  });

  it("returns 404 for unknown sales", async () => {
    expect(await assertCanPublishOnLax(reader(null), "s1")).toMatchObject({ status: 404 });
  });

  it("explains why an ATG-owned sale cannot be published", async () => {
    expect(await assertCanPublishOnLax(reader(live), "s1")).toMatchObject({
      status: 409,
      code: "sale_on_atg",
      message: "This sale is live on ATG. Close the ATG auction before you publish it on lax.bid.",
    });
    expect(await assertCanPublishOnLax(reader(closedWithSales), "s1")).toMatchObject({
      status: 409,
      code: "sale_on_atg",
      message: "Lots in this sale sold on ATG, so you can't publish it on lax.bid.",
    });
  });
});

describe("assertLotMovableOnAtg", () => {
  const linked = (state: Partial<AtgLotChannelState>): AtgLotChannelState => ({
    linked: true,
    numberOfBids: 0,
    sold: false,
    ...state,
  });

  it("allows lots without bids, unlinked lots, lots outside a sale and non-ATG sales", async () => {
    expect(await assertLotMovableOnAtg(reader(live, linked({})), "l1", "s1")).toBeNull();
    expect(await assertLotMovableOnAtg(reader(live), "l1", "s1")).toBeNull();
    expect(
      await assertLotMovableOnAtg(reader(live, linked({ sold: true })), "l1", null),
    ).toBeNull();
    expect(
      await assertLotMovableOnAtg(reader(closedNoSales, linked({ numberOfBids: 3 })), "l1", "s1"),
    ).toBeNull();
  });

  it("blocks lots with bids while the sale is ATG-owned", async () => {
    expect(
      await assertLotMovableOnAtg(reader(live, linked({ numberOfBids: 1 })), "l1", "s1"),
    ).toMatchObject({
      status: 409,
      code: "lot_on_atg",
      message: "This lot has bids on ATG. Close the ATG auction before you move or remove it.",
    });
  });

  it("blocks sold lots with a message that does not suggest closing ATG", async () => {
    expect(
      await assertLotMovableOnAtg(reader(closedWithSales, linked({ sold: true })), "l1", "s1"),
    ).toMatchObject({
      status: 409,
      code: "lot_on_atg",
      message: "This lot sold on ATG, so it stays with this sale. Settle it through ATG.",
    });
  });
});

describe.each([
  ["assertCanSoftDeleteSaleOnAtg", assertCanSoftDeleteSaleOnAtg, "delete it in LAX"],
  ["assertCanCancelSaleOnAtg", assertCanCancelSaleOnAtg, "cancel it in LAX"],
] as const)("%s", (_name, guard, action) => {
  it("blocks ATG-owned sales", async () => {
    expect(await guard(reader(live), "s1")).toMatchObject({
      status: 409,
      code: "sale_on_atg",
      message: `This sale is live on ATG. Close the ATG auction before you ${action}.`,
    });
    expect(await guard(reader(closedWithSales), "s1")).toMatchObject({
      message: `Lots in this sale sold on ATG, so you can't ${action}.`,
    });
  });

  it("allows free, LAX and unknown sales", async () => {
    expect(await guard(reader(closedNoSales), "s1")).toBeNull();
    expect(await guard(reader(ownership("scheduled", null)), "s1")).toBeNull();
    expect(await guard(reader(null), "s1")).toBeNull();
    expect(await guard(null, "s1")).toBeNull();
  });
});
