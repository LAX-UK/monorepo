import { describe, expect, it } from "vitest";
import {
  type AtgRemoteStatus,
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
