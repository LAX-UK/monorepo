import type { Lot, Sale } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  atgCatalogState,
  atgDisplayListLot,
  atgDisplayLot,
  atgDisplaySale,
  atgLotBadge,
} from "./atg-catalog-display";

const now = new Date("2026-10-14T12:00:00Z");
const past = new Date("2026-10-13T12:00:00Z");
const future = new Date("2026-10-15T12:00:00Z");

const sale = (over: Partial<Sale>) =>
  ({
    status: "draft",
    sellingPlatform: "atg",
    atgDistribution: "public_marketplace",
    startTime: past,
    ...over,
  }) as Sale;
const lot = (over: Partial<Lot>) =>
  ({ id: "l1", status: "draft", startTime: past, ...over }) as Lot;

describe("atgCatalogState", () => {
  it("is null unless the draft sale is ATG-owned", () => {
    expect(atgCatalogState(null)).toBeNull();
    expect(atgCatalogState(sale({ sellingPlatform: "free" }))).toBeNull();
    expect(atgCatalogState(sale({ status: "active" }))).toBeNull();
    expect(atgCatalogState(sale({ atgDistribution: "private_test" }))).toBeNull();
    expect(atgCatalogState(sale({ atgAuctionState: "live" }))).toBe("live");
    expect(atgCatalogState(sale({ atgAuctionState: "ended" }))).toBe("ended");
  });
});

describe("atgDisplaySale", () => {
  it("reads a live ATG sale as scheduled before its start and active after", () => {
    expect(atgDisplaySale(sale({ startTime: future }), now).status).toBe("scheduled");
    expect(atgDisplaySale(sale({}), now).status).toBe("active");
  });

  it("reads an ended ATG sale as ended and leaves other sales untouched", () => {
    expect(atgDisplaySale(sale({ atgAuctionState: "ended" }), now).status).toBe("ended");
    const free = sale({ sellingPlatform: "free" });
    expect(atgDisplaySale(free, now)).toBe(free);
  });
});

describe("atgDisplayLot", () => {
  it("maps draft lots to live or Sold/Unsold from the ATG result", () => {
    expect(atgDisplayLot(lot({}), sale({}), now).status).toBe("active");
    expect(atgDisplayLot(lot({ startTime: future }), sale({}), now).status).toBe("scheduled");
    const ended = sale({ atgAuctionState: "ended" });
    expect(atgDisplayLot(lot({ atgSold: true }), ended, now)).toMatchObject({
      status: "ended",
      hasWinner: true,
      winnerId: null,
    });
    expect(atgDisplayLot(lot({}), ended, now)).toMatchObject({ status: "ended", hasWinner: false });
  });

  it("leaves non-draft lots and lots of non-ATG sales untouched", () => {
    const cancelled = lot({ status: "cancelled" });
    expect(atgDisplayLot(cancelled, sale({}), now)).toBe(cancelled);
    const draft = lot({});
    expect(atgDisplayLot(draft, sale({ sellingPlatform: "lax" }), now)).toBe(draft);
  });
});

describe("atgDisplayListLot", () => {
  it("uses the API's atgSaleState tag", () => {
    expect(atgDisplayListLot(lot({ atgSaleState: "live" }), now).status).toBe("active");
    expect(atgDisplayListLot(lot({ atgSaleState: "ended", atgSold: true }), now)).toMatchObject({
      status: "ended",
      hasWinner: true,
    });
    const plain = lot({});
    expect(atgDisplayListLot(plain, now)).toBe(plain);
  });
});

describe("atgLotBadge", () => {
  it("labels live, sold, unsold and unknown results", () => {
    expect(atgLotBadge("live", undefined).label).toBe("On ATG");
    expect(atgLotBadge("ended", true).label).toBe("Sold");
    expect(atgLotBadge("ended", false).label).toBe("No sale");
    expect(atgLotBadge("ended", undefined).label).toBe("Ended on ATG");
  });
});
