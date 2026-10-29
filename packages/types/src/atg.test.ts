import { describe, expect, it } from "vitest";
import {
  type AtgRemoteStatus,
  atgLotSellingBadge,
  atgLotStatusLabel,
  atgReadinessBlockers,
  atgSaleSellingBadge,
  canChangeAtgAuctionType,
  canChangeAtgDistribution,
  canPublishSaleOnLax,
  canPushOrPublishSaleOnAtg,
  isLotOnAtg,
  isSaleOnAtg,
  resolveSaleSellingPlatform,
  toAtgSaleSellingSummary,
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
    [0, "Not yet offered"],
    [1, "Offered"],
    [2, "Not sold"],
    [4, "Sold"],
    ["0", "Not yet offered"],
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
  it("lists ownership, missing numbers by lot title, and uncertain creates", () => {
    expect(
      atgReadinessBlockers({
        sellingPlatform: "lax",
        saleCancelled: true,
        lastError: "ATG did not confirm the new auction (timeout). Check the ATG admin.",
        lots: [
          { lotNumber: null, title: "Garden study" },
          { lotNumber: 2, title: "Cornish coast" },
        ],
      }),
    ).toEqual([
      "This sale is published on lax.bid. Unpublish it there first.",
      "This sale is cancelled in LAX.",
      "“Garden study” needs a lot number.",
      "The last create may have reached ATG. Check Toolbox before pushing again.",
    ]);
  });

  it("is empty when the sale can be prepared", () => {
    expect(
      atgReadinessBlockers({
        sellingPlatform: "free",
        saleCancelled: false,
        lastError: null,
        lots: [{ lotNumber: 1, title: "Harbour at dusk" }],
      }),
    ).toEqual([]);
  });

  it("names up to three unnumbered lots, then counts the rest", () => {
    const blockers = (titles: string[]) =>
      atgReadinessBlockers({
        sellingPlatform: "free",
        saleCancelled: false,
        lastError: null,
        lots: titles.map((title) => ({ lotNumber: null, title })),
      });
    expect(blockers(["A", "B"])).toEqual(["“A” and “B” need lot numbers."]);
    expect(blockers(["A", "B", "C", "D", "E"])).toEqual([
      "“A”, “B”, “C” and 2 more need lot numbers.",
    ]);
  });
});

describe("selling badges", () => {
  type BadgeRow = {
    name: string;
    saleStatus: SaleStatus;
    atgRemoteStatus: AtgRemoteStatus | null;
    atgLinked: boolean;
    atgSoldLotCount: number;
    atgApprovedAt?: string | null;
    label: string | null;
    platform?: "lax" | "atg";
  };
  const APPROVED = "2026-10-20T10:00:00.000Z";
  const free = { atgRemoteStatus: null, atgLinked: false, atgSoldLotCount: 0 } as const;
  const linked = (atgRemoteStatus: AtgRemoteStatus, atgSoldLotCount = 0) =>
    ({ atgRemoteStatus, atgLinked: true, atgSoldLotCount }) as const;
  const badgeRows: BadgeRow[] = [
    { name: "unlinked draft (free)", saleStatus: "draft", ...free, label: null },
    {
      name: "scheduled on lax.bid",
      saleStatus: "scheduled",
      ...free,
      label: "lax.bid",
      platform: "lax",
    },
    { name: "active on lax.bid", saleStatus: "active", ...free, label: "lax.bid", platform: "lax" },
    { name: "ended on lax.bid", saleStatus: "ended", ...free, label: "lax.bid", platform: "lax" },
    {
      name: "lax.bid wins over a stale ATG draft",
      saleStatus: "scheduled",
      ...linked("created"),
      label: "lax.bid",
      platform: "lax",
    },
    {
      name: "ATG draft",
      saleStatus: "draft",
      ...linked("created"),
      label: "ATG · Draft",
      platform: "atg",
    },
    {
      name: "ATG draft approved in Toolbox",
      saleStatus: "draft",
      ...linked("created"),
      atgApprovedAt: APPROVED,
      label: "ATG · Approved",
      platform: "atg",
    },
    {
      name: "ATG approved status",
      saleStatus: "draft",
      ...linked("approved"),
      label: "ATG · Approved",
      platform: "atg",
    },
    {
      name: "ATG live",
      saleStatus: "draft",
      ...linked("published"),
      atgApprovedAt: APPROVED,
      label: "ATG · Live",
      platform: "atg",
    },
    {
      name: "ATG ended with sales",
      saleStatus: "draft",
      ...linked("closed", 2),
      label: "ATG · Ended",
      platform: "atg",
    },
    {
      name: "ATG closed with nothing sold (free again)",
      saleStatus: "draft",
      ...linked("closed"),
      label: "ATG · Closed",
      platform: "atg",
    },
    { name: "cancelled", saleStatus: "cancelled", ...free, label: null },
    {
      name: "cancelled with an ATG draft",
      saleStatus: "cancelled",
      ...linked("created"),
      label: null,
    },
  ];

  it.each(badgeRows)("$name → $label", (row) => {
    const summary = toAtgSaleSellingSummary({ ...row, atgApprovedAt: row.atgApprovedAt ?? null });
    expect(summary.sellingPlatform).toBe(resolveSaleSellingPlatform(row));
    const badge = atgSaleSellingBadge(summary);
    expect(badge?.label ?? null).toBe(row.label);
    expect(badge?.platform).toBe(row.platform);
    if (badge) expect(badge.description.length).toBeGreaterThan(0);
    expect(isSaleOnAtg(summary)).toBe(row.platform === "atg");
  });

  const atgSale = toAtgSaleSellingSummary({
    saleStatus: "draft",
    ...linked("published"),
    atgApprovedAt: null,
  });
  const laxSale = toAtgSaleSellingSummary({ saleStatus: "active", ...free, atgApprovedAt: null });
  const linkedLot = { remoteStatus: null, lastError: null, sold: null, numberOfBids: null };

  it("explains that lax.bid actions are disabled on ATG-owned sales", () => {
    const live = atgSaleSellingBadge(atgSale);
    expect(live?.description).toContain("auctions.lax.bid");
    expect(live?.description).toContain("Publish, cancel and delete are disabled here.");
  });

  it.each([
    ["0", "On ATG · Not yet offered"],
    ["1", "On ATG · Offered"],
    ["2", "On ATG · Not sold"],
    ["4", "On ATG · Sold"],
    [null, "On ATG"],
  ])("labels an ATG lot with status %s as %s", (remoteStatus, label) => {
    const badge = atgLotSellingBadge({
      saleId: "s1",
      sale: atgSale,
      lot: { ...linkedLot, remoteStatus },
    });
    expect(badge).toMatchObject({ platform: "atg", label });
  });

  it("shows sync errors, lax.bid lots, and nothing otherwise", () => {
    expect(
      atgLotSellingBadge({
        saleId: "s1",
        sale: atgSale,
        lot: { ...linkedLot, remoteStatus: "1", lastError: "ATG 500" },
      })?.label,
    ).toBe("On ATG · Sync error");
    expect(atgLotSellingBadge({ saleId: "s1", sale: laxSale, lot: null })).toMatchObject({
      platform: "lax",
      label: "lax.bid",
    });
    expect(atgLotSellingBadge({ saleId: null, sale: null, lot: null })).toBeNull();
    expect(atgLotSellingBadge({ saleId: "s1", sale: atgSale, lot: null })).toBeNull();
    const cancelled = { ...atgSale, sellingPlatform: "cancelled" as const };
    expect(atgLotSellingBadge({ saleId: "s1", sale: cancelled, lot: linkedLot })).toBeNull();
  });

  it("marks list rows only when the header shows an ATG badge", () => {
    expect(isLotOnAtg({ saleId: "s1", sale: atgSale, lot: linkedLot })).toBe(true);
    expect(isLotOnAtg({ saleId: "s1", sale: laxSale, lot: linkedLot })).toBe(false);
    expect(isLotOnAtg({ saleId: "s1", sale: atgSale, lot: null })).toBe(false);
    expect(isLotOnAtg(null)).toBe(false);
    expect(isSaleOnAtg(undefined)).toBe(false);
  });
});
