import { beforeEach, describe, expect, it } from "vitest";
import { testAtgConfig, testLot, testSale } from "./__fixtures__/atg-snapshots.js";
import {
  FakeAtgGateway,
  FakeAtgImageInspector,
  InMemoryAtgSyncStore,
} from "./__fixtures__/fakes.js";
import { AtgGatewayError } from "./atg-gateway.js";
import { AtgLotSyncer, AtgPartialSyncError } from "./atg-lot-syncer.js";

const NOW = new Date("2026-10-13T12:00:00Z");
const AUCTION_ID = "atg-auction-1";

describe("AtgLotSyncer", () => {
  let gateway: FakeAtgGateway;
  let store: InMemoryAtgSyncStore;
  let images: FakeAtgImageInspector;
  let syncer: AtgLotSyncer;

  beforeEach(() => {
    gateway = new FakeAtgGateway();
    store = new InMemoryAtgSyncStore();
    images = new FakeAtgImageInspector();
    syncer = new AtgLotSyncer({
      gateway,
      store,
      imageInspector: images,
      config: testAtgConfig,
      now: () => NOW,
    });
  });

  it("creates lots and appends images, then reports nothing to change on a repeat", async () => {
    const sale = testSale({ lots: [testLot({ images: ["a.jpg", "b.jpg"] })] });

    const first = await syncer.syncLots(sale, AUCTION_ID, true);
    gateway.calls.length = 0;
    const second = await syncer.syncLots(sale, AUCTION_ID, false);

    expect(first.summary).toEqual({ created: 1, updated: 0, unchanged: 0, deleted: 0, failed: 0 });
    expect(store.lotLinks.get("lot-1")).toMatchObject({
      atgLotId: "atg-lot-1",
      imageNames: ["1.jpg", "1-1.jpg"],
      lastSyncedAt: NOW,
    });
    expect(second.summary).toMatchObject({ unchanged: 1, created: 0 });
    expect(gateway.ops()).toEqual([]);
  });

  it("deletes the ATG lot of a lot that left the sale", async () => {
    await store.insertLotLink({
      lotId: "gone",
      saleId: "sale-1",
      atgLotId: "atg-gone",
      payloadHash: "x",
      lockedFieldsHash: "x",
    });

    const { summary } = await syncer.syncLots(testSale({ lots: [] }), AUCTION_ID, false);

    expect(summary.deleted).toBe(1);
    expect(gateway.calls).toEqual([{ op: "deleteLot", arg: "atg-gone" }]);
    expect(store.lotLinks.has("gone")).toBe(false);
  });

  it("refuses to change the locked fields of a lot that has bids", async () => {
    const sale = testSale({ lots: [testLot()] });
    await syncer.syncLots(sale, AUCTION_ID, true);
    const link = store.lotLinks.get("lot-1");
    if (!link) throw new Error("lot not linked");
    store.lotLinks.set("lot-1", { ...link, numberOfBids: 3 });
    gateway.calls.length = 0;

    const { summary, failures } = await syncer.syncLots(
      testSale({ lots: [testLot({ reservePrice: "900.00" })] }),
      AUCTION_ID,
      false,
    );

    expect(summary.failed).toBe(1);
    expect(failures[0]).toContain("has bids on ATG");
    expect(gateway.ops()).not.toContain("updateLot");
  });

  it("names the image that ATG can't take before writing the lot", async () => {
    images.facts.set("https://media.example/a.jpg", {
      contentType: "image/png",
      bytes: 100,
      error: null,
    });

    const { summary, failures } = await syncer.syncLots(
      testSale({ lots: [testLot({ images: ["a.jpg"] })] }),
      AUCTION_ID,
      true,
    );

    expect(summary.failed).toBe(1);
    expect(failures[0]).toBe(
      "Lot 1: ATG can't take this lot's images: image 1 must be a JPG (is image/png)",
    );
    expect(gateway.ops()).toEqual([]);
  });

  it("throws a partial-sync error when a lot hit a transient ATG error", async () => {
    gateway.failNext("createLot", new AtgGatewayError("busy", true, 503, "createLot"));

    await expect(syncer.syncLots(testSale(), AUCTION_ID, true)).rejects.toBeInstanceOf(
      AtgPartialSyncError,
    );
    expect(store.auctionLinks.get("sale-1")?.lastError).toContain("busy");
  });
});
