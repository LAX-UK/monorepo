import { describe, expect, it } from "vitest";
import {
  type AtgRemoteStatus,
  atgLotStatusLabel,
  atgReadinessBlockers,
  canChangeAtgAuctionType,
  canChangeAtgDistribution,
  canPublishSaleOnLax,
  canPushOrPublishSaleOnAtg,
  resolveSaleSellingPlatform,
} from "./atg.js";
import type { SaleStatus } from "./sale.js";

type Row = {
  saleStatus: SaleStatus;
  atgRemoteStatus: AtgRemoteStatus | null;
  atgLinked: boolean;
  atgSoldLotCount: number;
  expected: ReturnType<typeof resolveSaleSellingPlatform>;
  laxPublish: boolean;
  atgPush: boolean;
};

const rows: Row[] = [
  {
    saleStatus: "draft",
    atgRemoteStatus: null,
    atgLinked: false,
    atgSoldLotCount: 0,
    expected: "free",
    laxPublish: true,
    atgPush: true,
  },
  {
    saleStatus: "draft",
    atgRemoteStatus: "created",
    atgLinked: true,
    atgSoldLotCount: 0,
    expected: "free",
    laxPublish: true,
    atgPush: true,
  },
  {
    saleStatus: "draft",
    atgRemoteStatus: "closed",
    atgLinked: true,
    atgSoldLotCount: 0,
    expected: "free",
    laxPublish: true,
    atgPush: true,
  },
  {
    saleStatus: "draft",
    atgRemoteStatus: "published",
    atgLinked: true,
    atgSoldLotCount: 0,
    expected: "atg",
    laxPublish: false,
    atgPush: true,
  },
  {
    saleStatus: "draft",
    atgRemoteStatus: "published",
    atgLinked: false,
    atgSoldLotCount: 0,
    expected: "free",
    laxPublish: true,
    atgPush: true,
  },
  {
    saleStatus: "draft",
    atgRemoteStatus: "closed",
    atgLinked: true,
    atgSoldLotCount: 2,
    expected: "atg",
    laxPublish: false,
    atgPush: true,
  },
  {
    saleStatus: "scheduled",
    atgRemoteStatus: null,
    atgLinked: false,
    atgSoldLotCount: 0,
    expected: "lax",
    laxPublish: false,
    atgPush: false,
  },
  {
    saleStatus: "active",
    atgRemoteStatus: "published",
    atgLinked: true,
    atgSoldLotCount: 1,
    expected: "lax",
    laxPublish: false,
    atgPush: false,
  },
  {
    saleStatus: "ended",
    atgRemoteStatus: null,
    atgLinked: false,
    atgSoldLotCount: 0,
    expected: "lax",
    laxPublish: false,
    atgPush: false,
  },
  {
    saleStatus: "cancelled",
    atgRemoteStatus: "published",
    atgLinked: true,
    atgSoldLotCount: 0,
    expected: "cancelled",
    laxPublish: false,
    atgPush: false,
  },
];

describe("resolveSaleSellingPlatform", () => {
  it.each(rows)(
    "$saleStatus / ATG $atgRemoteStatus / sold $atgSoldLotCount => $expected",
    ({
      saleStatus,
      atgRemoteStatus,
      atgLinked,
      atgSoldLotCount,
      expected,
      laxPublish,
      atgPush,
    }) => {
      const state = resolveSaleSellingPlatform({
        saleStatus,
        atgRemoteStatus,
        atgLinked,
        atgSoldLotCount,
      });
      expect(state).toBe(expected);
      expect(canPublishSaleOnLax(state)).toBe(laxPublish);
      expect(canPushOrPublishSaleOnAtg(state)).toBe(atgPush);
    },
  );
});

describe("atgLotStatusLabel", () => {
  it.each([
    [0, "Waiting"],
    [1, "Offered"],
    [2, "Not sold"],
    [4, "Sold"],
    ["0", "Waiting"],
    ["4", "Sold"],
  ])("labels documented code %s", (code, label) => {
    expect(atgLotStatusLabel(code)).toBe(label);
  });

  it("returns null for missing and undocumented codes", () => {
    expect(atgLotStatusLabel(null)).toBeNull();
    expect(atgLotStatusLabel(undefined)).toBeNull();
    expect(atgLotStatusLabel("")).toBeNull();
    expect(atgLotStatusLabel(3)).toBeNull();
    expect(atgLotStatusLabel("7")).toBeNull();
    expect(atgLotStatusLabel("Sold")).toBeNull();
  });
});

describe("ATG settings locks", () => {
  it("fixes the auction type once ATG has the auction", () => {
    expect(canChangeAtgAuctionType({ linked: false })).toBe(true);
    expect(canChangeAtgAuctionType({ linked: true })).toBe(false);
  });

  it("fixes distribution once published or closed", () => {
    expect(canChangeAtgDistribution({ remoteStatus: null })).toBe(true);
    expect(canChangeAtgDistribution({ remoteStatus: "created" })).toBe(true);
    expect(canChangeAtgDistribution({ remoteStatus: "published" })).toBe(false);
    expect(canChangeAtgDistribution({ remoteStatus: "closed" })).toBe(false);
  });
});

describe("atgReadinessBlockers", () => {
  it("lists ownership, missing numbers, lot errors, and uncertain creates", () => {
    expect(
      atgReadinessBlockers({
        sellingPlatform: "lax",
        saleCancelled: true,
        lastError: "ATG did not confirm the new auction (timeout). Check the ATG admin.",
        lots: [
          { lotNumber: null, lastError: null },
          { lotNumber: 2, lastError: "must be a JPG" },
        ],
      }),
    ).toEqual([
      "This sale is published on lax.bid. Unpublish it there first.",
      "This sale is cancelled in LAX.",
      "1 lot needs a lot number.",
      "1 lot has a sync error.",
      "The last create may have reached ATG. Check Toolbox before pushing again.",
    ]);
  });

  it("is empty when the sale can be prepared", () => {
    expect(
      atgReadinessBlockers({
        sellingPlatform: "free",
        saleCancelled: false,
        lastError: null,
        lots: [{ lotNumber: 1, lastError: null }],
      }),
    ).toEqual([]);
  });
});
