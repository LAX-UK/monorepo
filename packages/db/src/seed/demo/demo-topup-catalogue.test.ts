import { describe, expect, it } from "vitest";
import { assertDemoTopUpTarget } from "../runners/demo-topup-cli.js";
import { buildDemoCatalogue } from "./demo-topup-catalogue.js";

const NOW = Date.UTC(2026, 9, 30, 10, 0, 0);
const actors = {
  collectorUserId: "collector",
  collectorEntityId: "collector-entity",
  rivalUserId: "rival",
  rivalEntityId: "rival-entity",
  northbankBuyerUserId: "buyer",
  northbankId: "northbank",
  consignorUserId: "consignor",
  laxStockId: "lax",
};
const catalogue = buildDemoCatalogue(NOW, actors);
const DAY = 86_400_000;

describe("demo top-up catalogue", () => {
  it("has a live, a saleroom, an upcoming and two finished sales around the clock", () => {
    const byKey = Object.fromEntries(catalogue.sales.map((s) => [s.key, s]));
    expect(byKey.live?.startTime.getTime()).toBeLessThan(NOW);
    expect(byKey.live?.endTime.getTime()).toBeGreaterThan(NOW);
    expect(byKey.saleroom?.deliveryMode).toBe("hybrid");
    expect(byKey.upcoming?.startTime.getTime()).toBeGreaterThan(NOW);
    expect(byKey.finished?.endTime.getTime()).toBeLessThan(NOW);
    expect(byKey.older?.endTime.getTime()).toBeLessThan(NOW - 7 * DAY);
  });

  it("gives every lot a unique number in its sale and keeps live lots open", () => {
    const keys = catalogue.lots.map((l) => `${l.saleId}:${l.lotNumber}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const lot of catalogue.lots.filter((l) => l.status === "active")) {
      expect(lot.endTime.getTime()).toBeGreaterThan(NOW);
    }
  });

  it("has at most one winning bid per lot, matching the lot's price", () => {
    for (const lot of catalogue.lots) {
      const bids = catalogue.bids.filter((b) => b.lotId === lot.id);
      const winning = bids.filter((b) => b.isWinning);
      expect(winning.length).toBeLessThanOrEqual(1);
      if (bids.length > 0) {
        expect(lot.currentPrice).toBe(Math.max(...bids.map((b) => b.amount)));
      }
      if (lot.winnerUserId) expect(winning[0]?.bidderUserId).toBe(lot.winnerUserId);
    }
  });

  it("puts the collector both in the lead and outbid in the live sale", () => {
    const live = catalogue.sales.find((s) => s.key === "live");
    const liveLots = catalogue.lots.filter((l) => l.saleId === live?.id);
    const top = (lotId: string) =>
      catalogue.bids.filter((b) => b.lotId === lotId).sort((a, b) => b.amount - a.amount)[0];
    const collectorBidLots = liveLots.filter((l) =>
      catalogue.bids.some((b) => b.lotId === l.id && b.bidderUserId === "collector"),
    );
    const leading = collectorBidLots.filter((l) => top(l.id)?.bidderUserId === "collector");
    expect(leading.length).toBeGreaterThan(0);
    expect(collectorBidLots.length).toBeGreaterThan(leading.length);
  });

  it("raises invoices that are due, overdue and paid", () => {
    const states = catalogue.payments.map((p) => {
      if (p.status === "captured") return "paid";
      return NOW - p.createdAt.getTime() > 7 * DAY ? "overdue" : "due";
    });
    expect(new Set(states)).toEqual(new Set(["paid", "due", "overdue"]));
  });

  it("covers every consignment stage for Northbank", () => {
    const stages = new Set(
      catalogue.submissions.filter((s) => s.legalEntityId === "northbank").map((s) => s.status),
    );
    for (const stage of ["draft", "submitted", "changes_requested", "approved", "converted"]) {
      expect(stages.has(stage as never)).toBe(true);
    }
    const unsold = catalogue.lots.find((l) => l.title === "Field Notes II");
    expect(unsold?.status).toBe("ended");
    expect(unsold?.winnerUserId).toBeNull();
  });
});

describe("demo top-up target guard", () => {
  it("refuses production", () => {
    expect(() =>
      assertDemoTopUpTarget({ databaseUrl: "postgres://x@localhost/db", nodeEnv: "production" }),
    ).toThrow(/production/);
    expect(() =>
      assertDemoTopUpTarget({ databaseUrl: "postgres://x@lax-prod-postgres.example/db" }),
    ).toThrow(/production/);
  });

  it("accepts a test database", () => {
    expect(
      assertDemoTopUpTarget({ databaseUrl: "postgres://x@lax-test-postgres.example/db" }),
    ).toContain("lax-test-postgres");
  });
});
