import { describe, expect, it } from "vitest";
import { SETTLEMENT_PERIOD_FLOOR, resolveSettlementPeriod } from "./settlement-period.js";

const NOW = new Date("2026-11-07T12:00:00Z");
const LAST = new Date("2026-10-31T23:59:59Z");

describe("resolveSettlementPeriod", () => {
  it("starts where the last settled period ended and ends now", () => {
    expect(
      resolveSettlementPeriod({ now: NOW, lastSettledEnd: LAST, earliestPending: null }),
    ).toEqual({ ok: true, periodStart: LAST, periodEnd: NOW });
  });

  it("starts a first run at the oldest waiting payment", () => {
    const oldest = new Date("2026-09-02T08:00:00Z");
    expect(
      resolveSettlementPeriod({ now: NOW, lastSettledEnd: null, earliestPending: oldest }),
    ).toEqual({ ok: true, periodStart: oldest, periodEnd: NOW });
  });

  it("never starts at the epoch, even when nothing else is known", () => {
    const result = resolveSettlementPeriod({
      now: NOW,
      lastSettledEnd: null,
      earliestPending: new Date(0),
    });
    expect(result).toEqual({ ok: true, periodStart: SETTLEMENT_PERIOD_FLOOR, periodEnd: NOW });
  });

  it("refuses a requested start at the epoch as open-ended", () => {
    expect(
      resolveSettlementPeriod({
        now: NOW,
        requestedStart: new Date(0),
        lastSettledEnd: null,
        earliestPending: null,
      }),
    ).toEqual({ ok: false, reason: "settlement_period_open_ended" });
  });

  it("refuses a requested start before the last settled end as an overlap", () => {
    expect(
      resolveSettlementPeriod({
        now: NOW,
        requestedStart: new Date("2026-10-15T00:00:00Z"),
        lastSettledEnd: LAST,
        earliestPending: null,
      }),
    ).toEqual({ ok: false, reason: "settlement_period_overlaps" });
  });

  it("accepts a requested start on or after the last settled end", () => {
    const start = new Date("2026-11-01T00:00:00Z");
    expect(
      resolveSettlementPeriod({
        now: NOW,
        requestedStart: start,
        lastSettledEnd: LAST,
        earliestPending: null,
      }),
    ).toEqual({ ok: true, periodStart: start, periodEnd: NOW });
  });

  it("refuses a start in the future", () => {
    expect(
      resolveSettlementPeriod({
        now: NOW,
        requestedStart: new Date("2026-12-01T00:00:00Z"),
        lastSettledEnd: null,
        earliestPending: null,
      }),
    ).toEqual({ ok: false, reason: "settlement_period_in_future" });
  });

  it("refuses when the last settled period already ends after now", () => {
    expect(
      resolveSettlementPeriod({
        now: NOW,
        lastSettledEnd: new Date("2026-11-08T00:00:00Z"),
        earliestPending: null,
      }),
    ).toEqual({ ok: false, reason: "settlement_period_overlaps" });
  });
});
