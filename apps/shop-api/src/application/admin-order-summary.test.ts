import { describe, expect, it } from "vitest";
import { buildOrderSummary, orderSummarySince, ukDayKeys } from "./admin-order-summary.js";

describe("ukDayKeys", () => {
  it("counts UK days, so a late evening in summer belongs to the next day", () => {
    // 23:30 UTC on 30 June is 00:30 on 1 July in London.
    expect(ukDayKeys(new Date("2026-06-30T23:30:00.000Z"), 3)).toEqual([
      "2026-06-29",
      "2026-06-30",
      "2026-07-01",
    ]);
  });

  it("steps back over the clock change without skipping or repeating a day", () => {
    expect(ukDayKeys(new Date("2026-10-26T10:00:00.000Z"), 3, 1)).toEqual([
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ]);
  });
});

describe("buildOrderSummary", () => {
  const now = new Date("2026-10-26T10:00:00.000Z");

  it("lays the totals out over the last 30 days and compares with the 30 before", () => {
    const summary = buildOrderSummary(
      {
        paid: new Map([
          ["2026-10-26", { pence: 18500, orders: 1 }],
          ["2026-09-27", { pence: 4200, orders: 2 }],
          ["2026-09-26", { pence: 9600, orders: 1 }],
          ["2026-08-27", { pence: 100, orders: 1 }],
        ]),
        placed: new Map([
          ["2026-10-25", 3],
          ["2026-09-20", 2],
        ]),
      },
      now,
    );
    expect(summary.periodDays).toBe(30);
    expect(summary.paidPence.daily).toHaveLength(30);
    expect(summary.paidPence.daily[0]).toBe(4200);
    expect(summary.paidPence.daily[29]).toBe(18500);
    expect(summary.paidPence).toMatchObject({ current: 22700, prior: 9600 });
    expect(summary.orders).toMatchObject({ current: 3, prior: 2 });
    expect(summary.orders.daily[28]).toBe(3);
    expect(summary.paidOrders).toEqual({ current: 3, prior: 1 });
  });

  it("reads from before the comparison window starts", () => {
    expect(orderSummarySince(now).toISOString()).toBe("2026-08-26T10:00:00.000Z");
  });
});
