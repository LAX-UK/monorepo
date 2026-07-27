import { afterEach, describe, expect, it } from "vitest";
import {
  auctionMinuteEpoch,
  formatAuctionDatetimeDisplay,
  instantFromAuctionDatetimeFormString,
  isStartInFutureForPublish,
  toAuctionDatetimeFormString,
} from "./auction-datetime.js";
import {
  type LotSaleTimingWindow,
  alignLotTimingWithSale,
  findLotTimingConflicts,
  lotTimingViolationAgainstSale,
  normalizeLotTimingForSale,
} from "./lot-sale-timing.js";

const saleStart = new Date("2026-06-01T10:00:00Z");
const saleEnd = new Date("2026-06-07T18:00:00Z");

const onlineSale: LotSaleTimingWindow = {
  deliveryMode: "online",
  startTime: saleStart,
  endTime: saleEnd,
};

const onsiteSale: LotSaleTimingWindow = {
  deliveryMode: "onsite",
  startTime: saleStart,
  endTime: saleEnd,
};

describe("formatAuctionDatetimeDisplay", () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    if (originalTz === undefined) {
      process.env.TZ = undefined;
    } else {
      process.env.TZ = originalTz;
    }
  });

  it("formats wall-clock time in Europe/London during BST", () => {
    process.env.TZ = "America/New_York";
    const instant = instantFromAuctionDatetimeFormString("2030-06-01T21:00");
    expect(formatAuctionDatetimeDisplay(instant)).toBe("Sat 1 Jun 2030, 21:00");
  });

  it("formats wall-clock time in Europe/London during GMT", () => {
    process.env.TZ = "Asia/Tokyo";
    const instant = instantFromAuctionDatetimeFormString("2030-01-15T14:30");
    expect(formatAuctionDatetimeDisplay(instant)).toBe("Tue 15 Jan 2030, 14:30");
  });
});

describe("auctionMinuteEpoch", () => {
  it("treats sub-minute offsets within the same London minute as equal", () => {
    const base = instantFromAuctionDatetimeFormString("2026-06-01T11:00");
    const withSeconds = new Date(base.getTime() + 30_000);
    expect(auctionMinuteEpoch(base)).toBe(auctionMinuteEpoch(withSeconds));
  });
});

describe("isStartInFutureForPublish", () => {
  it("accepts start time in the current auction minute", () => {
    const now = instantFromAuctionDatetimeFormString("2030-06-01T10:15");
    const start = new Date(now.getTime() + 15_000);
    expect(isStartInFutureForPublish(start, now)).toBe(true);
  });

  it("rejects start time in a past auction minute", () => {
    const now = instantFromAuctionDatetimeFormString("2030-06-01T10:15");
    const start = instantFromAuctionDatetimeFormString("2030-06-01T10:14");
    expect(isStartInFutureForPublish(start, now)).toBe(false);
  });
});

describe("alignLotTimingWithSale", () => {
  it("inherits sale window for onsite sales", () => {
    const lotStart = new Date("2026-06-02T10:00:00Z");
    const lotEnd = new Date("2026-06-03T18:00:00Z");
    expect(alignLotTimingWithSale(onsiteSale, lotStart, lotEnd)).toEqual({
      startTime: saleStart,
      endTime: saleEnd,
    });
  });

  it("keeps lot times for online sales", () => {
    const lotStart = new Date("2026-06-02T10:00:00Z");
    const lotEnd = new Date("2026-06-03T18:00:00Z");
    expect(alignLotTimingWithSale(onlineSale, lotStart, lotEnd)).toEqual({
      startTime: lotStart,
      endTime: lotEnd,
    });
  });
});

describe("lotTimingViolationAgainstSale", () => {
  it("accepts online lot times within the sale window", () => {
    expect(
      lotTimingViolationAgainstSale(
        onlineSale,
        new Date("2026-06-02T10:00:00Z"),
        new Date("2026-06-03T18:00:00Z"),
      ),
    ).toBeNull();
  });

  it("accepts online lot start in same minute as sale start despite sub-minute drift", () => {
    const saleWithSeconds = {
      ...onlineSale,
      startTime: new Date(saleStart.getTime() + 30_000),
    };
    const lotAtMinute = instantFromAuctionDatetimeFormString(
      toAuctionDatetimeFormString(saleStart),
    );
    expect(
      lotTimingViolationAgainstSale(saleWithSeconds, lotAtMinute, new Date("2026-06-03T18:00:00Z")),
    ).toBeNull();
  });

  it("rejects online lot start before sale start", () => {
    expect(
      lotTimingViolationAgainstSale(
        onlineSale,
        new Date("2026-05-31T10:00:00Z"),
        new Date("2026-06-03T18:00:00Z"),
      ),
    ).toContain("before the sale start");
  });

  it("rejects online lot end after sale end", () => {
    expect(
      lotTimingViolationAgainstSale(
        onlineSale,
        new Date("2026-06-02T10:00:00Z"),
        new Date("2026-06-08T18:00:00Z"),
      ),
    ).toContain("after the sale end");
  });

  it("requires exact minute match for onsite sales", () => {
    expect(
      lotTimingViolationAgainstSale(
        onsiteSale,
        new Date("2026-06-02T10:00:00Z"),
        new Date("2026-06-03T18:00:00Z"),
      ),
    ).toContain("Onsite lots must use the sale");
  });

  it("accepts onsite lot at sale minute boundaries despite sub-second drift", () => {
    const saleWithSeconds = {
      ...onsiteSale,
      startTime: new Date(saleStart.getTime() + 45_000),
      endTime: new Date(saleEnd.getTime() + 45_000),
    };
    const lotStart = instantFromAuctionDatetimeFormString(toAuctionDatetimeFormString(saleStart));
    const lotEnd = instantFromAuctionDatetimeFormString(toAuctionDatetimeFormString(saleEnd));
    expect(lotTimingViolationAgainstSale(saleWithSeconds, lotStart, lotEnd)).toBeNull();
  });
});

describe("findLotTimingConflicts", () => {
  it("includes onsite lots that drift from the sale window", () => {
    const conflicts = findLotTimingConflicts(onsiteSale, [
      {
        id: "lot-1",
        title: "Vase",
        startTime: new Date("2026-06-02T10:00:00Z"),
        endTime: new Date("2026-06-03T18:00:00Z"),
      },
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.violation).toContain("Onsite lots");
  });
});

describe("normalizeLotTimingForSale", () => {
  it("coerces onsite lot to sale window without violation", () => {
    const result = normalizeLotTimingForSale(
      onsiteSale,
      new Date("2026-06-02T10:00:00Z"),
      new Date("2026-06-03T18:00:00Z"),
    );
    expect(result.startTime).toEqual(saleStart);
    expect(result.endTime).toEqual(saleEnd);
    expect(result.violation).toBeNull();
  });

  it("surfaces violation for online lot outside sale window", () => {
    const result = normalizeLotTimingForSale(
      onlineSale,
      new Date("2026-05-31T10:00:00Z"),
      new Date("2026-06-03T18:00:00Z"),
    );
    expect(result.violation).not.toBeNull();
  });
});
