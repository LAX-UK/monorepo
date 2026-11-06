import { describe, expect, it } from "vitest";
import { assertDemoFullTarget } from "../runners/demo-full-cli.js";
import { buildFullCatalogue } from "./demo-full-catalogue.js";
import { DEPARTMENTS, WORKS } from "./demo-full-works.js";

const actors = {
  collectorUserId: "collector",
  collectorEntityId: "collector-entity",
  rivalUserId: "rival",
  rivalEntityId: "rival-entity",
  northbankBuyerUserId: "buyer",
  northbankId: "northbank",
  heldUserId: "held",
  heldEntityId: "held-entity",
  laxStockId: "lax",
};
const DAY = 86_400_000;

/** The catalogue is rebuilt for several clock readings: the live sale must be live in each. */
const CLOCKS = [
  Date.UTC(2026, 10, 6, 9, 0),
  Date.UTC(2027, 0, 15, 23, 30),
  Date.UTC(2026, 5, 1, 0, 0),
];

describe.each(CLOCKS)("full demo catalogue at %d", (now) => {
  const catalogue = buildFullCatalogue(now, actors);
  const sale = (key: string) => {
    const found = catalogue.sales.find((s) => s.key === key);
    if (!found) throw new Error(key);
    return found;
  };
  const lotsOf = (key: string) => catalogue.lots.filter((l) => l.saleId === sale(key).id);

  it("keeps the timed sale live, closing lot by lot over the next three days", () => {
    const live = sale("depts");
    expect(live.status).toBe("active");
    expect(live.startTime.getTime()).toBeLessThan(now);
    const closes = lotsOf("depts").map((l) => l.endTime.getTime());
    expect(Math.min(...closes)).toBeGreaterThan(now);
    expect(Math.max(...closes)).toBeLessThanOrEqual(now + 3 * DAY);
    expect(new Set(closes).size).toBe(closes.length);
  });

  it("puts a lot from every department in the sales", () => {
    const departments = new Set(catalogue.lots.map((l) => l.categorySlug));
    for (const department of DEPARTMENTS) expect(departments.has(department.slug)).toBe(true);
  });

  it("has a saleroom sale in a few days and three more upcoming sales", () => {
    const room = sale("room");
    expect(room.deliveryMode).toBe("hybrid");
    expect(room.startTime.getTime() - now).toBeGreaterThan(3 * DAY);
    expect(room.startTime.getTime() - now).toBeLessThan(6 * DAY);
    for (const key of ["photoPrints", "designWatches", "booksCoins"]) {
      expect(sale(key).status).toBe("scheduled");
      expect(sale(key).startTime.getTime()).toBeGreaterThan(now + 14 * DAY);
      expect(sale(key).coverImage).toMatch(
        /^https:\/\/lax-media\.lon1\.cdn\.digitaloceanspaces\.com\/demo\/cover\//,
      );
    }
  });

  it("gives most live lots bids, with reserves met and not met and one contested lot", () => {
    const live = lotsOf("depts");
    const withBids = live.filter((l) => catalogue.bids.some((b) => b.lotId === l.id));
    expect(withBids.length).toBeGreaterThanOrEqual(live.length - 2);
    expect(
      live.some((l) => l.currentPrice >= l.reservePrice && l.currentPrice > l.startingPrice),
    ).toBe(true);
    expect(live.some((l) => l.currentPrice < l.reservePrice)).toBe(true);
    const most = Math.max(
      ...live.map((l) => catalogue.bids.filter((b) => b.lotId === l.id).length),
    );
    expect(most).toBeGreaterThanOrEqual(10);
  });

  it("keeps bids in the past, rising, with one winning bid at the lot price", () => {
    for (const lot of catalogue.lots) {
      const bids = catalogue.bids
        .filter((b) => b.lotId === lot.id)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      for (const [i, bid] of bids.entries()) {
        expect(bid.createdAt.getTime()).toBeLessThanOrEqual(now);
        if (i > 0) expect(bid.amount).toBeGreaterThan(bids[i - 1]?.amount ?? 0);
      }
      const winning = bids.filter((b) => b.isWinning);
      expect(winning.length).toBeLessThanOrEqual(1);
      if (winning[0]) expect(winning[0].amount).toBe(lot.currentPrice);
    }
  });

  it("has a finished sale with sold, unsold and withdrawn lots and a held invoice", () => {
    const past = lotsOf("autumnPast");
    expect(past.some((l) => l.winnerUserId !== null)).toBe(true);
    expect(past.some((l) => l.status === "ended" && l.winnerUserId === null)).toBe(true);
    expect(past.some((l) => l.status === "cancelled")).toBe(true);
    const held = catalogue.payments.filter((p) => p.buyerUserId === "held");
    expect(held).toHaveLength(1);
    expect(held[0]?.status).toBe("pending");
    expect(catalogue.payments.every((p) => catalogue.lots.some((l) => l.id === p.lotId))).toBe(
      true,
    );
  });

  it("numbers lots uniquely and uses fixed ids", () => {
    const numbers = catalogue.lots.map((l) => `${l.saleId}:${l.lotNumber}`);
    expect(new Set(numbers).size).toBe(numbers.length);
    const again = buildFullCatalogue(now, actors);
    expect(again.lots.map((l) => l.id)).toEqual(catalogue.lots.map((l) => l.id));
  });
});

describe("full demo works", () => {
  it("gives every work an https picture and a believable estimate", () => {
    for (const work of Object.values(WORKS)) {
      expect(work.image).toMatch(/^https:\/\//);
      expect(work.estimate[0]).toBeLessThan(work.estimate[1]);
      expect(work.note).toMatch(/Provenance:/);
      expect(work.note).toMatch(/Condition:/);
    }
  });
});

describe("assertDemoFullTarget", () => {
  it("refuses production by environment or host", () => {
    expect(() =>
      assertDemoFullTarget({
        databaseUrl: "postgres://u:p@db.example.com/x",
        appEnv: "production",
      }),
    ).toThrow(/production/);
    expect(() =>
      assertDemoFullTarget({ databaseUrl: "postgres://u:p@prod-db.example.com/x" }),
    ).toThrow(/production/);
    expect(assertDemoFullTarget({ databaseUrl: "postgres://u:p@test-db.example.com/x" })).toContain(
      "test-db",
    );
  });
});
