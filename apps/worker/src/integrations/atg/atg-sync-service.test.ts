import { beforeEach, describe, expect, it } from "vitest";
import { testAtgConfig, testLot, testSale } from "./__fixtures__/atg-snapshots.js";
import { FakeAtgGateway, InMemoryAtgSyncStore } from "./__fixtures__/fakes.js";
import { AtgGatewayError } from "./atg-gateway.js";
import {
  AtgPartialSyncError,
  AtgSyncPreconditionError,
  AtgSyncService,
} from "./atg-sync-service.js";
import type { AtgSyncConfig } from "./atg-types.js";

const NOW = new Date("2026-10-13T12:00:00Z");

function transient(op: string) {
  return new AtgGatewayError(`ATG ${op} failed with HTTP 503: busy`, true, 503, op);
}

function rejected(op: string) {
  return new AtgGatewayError(`ATG ${op} failed with HTTP 400: invalid`, false, 400, op);
}

describe("AtgSyncService", () => {
  let gateway: FakeAtgGateway;
  let store: InMemoryAtgSyncStore;
  let service: AtgSyncService;

  function build(config: Partial<AtgSyncConfig> = {}) {
    service = new AtgSyncService({
      gateway,
      store,
      config: { ...testAtgConfig, ...config },
      now: () => NOW,
    });
  }

  beforeEach(() => {
    gateway = new FakeAtgGateway();
    store = new InMemoryAtgSyncStore();
    store.sales.set(
      "sale-1",
      testSale({
        lots: [
          testLot({ id: "lot-1", lotNumber: 1, images: ["a.jpg", "b.jpg"] }),
          testLot({ id: "lot-2", lotNumber: 2, images: [] }),
        ],
      }),
    );
    build();
  });

  describe("pushSale", () => {
    it("creates the auction, lots and images on first push and records links", async () => {
      const summary = await service.pushSale("sale-1");

      expect(summary).toEqual({ created: 2, updated: 0, unchanged: 0, deleted: 0, failed: 0 });
      expect(gateway.ops()).toEqual([
        "createAuction",
        "createLot",
        "addLotImageUrl",
        "addLotImageUrl",
        "createLot",
      ]);
      expect(gateway.calls[1]?.arg).toMatchObject({ AuctionId: "atg-auction-1", LotNumber: "1" });
      expect(gateway.calls[3]?.arg).toEqual({
        LotId: "atg-lot-1",
        ImageName: "1-1",
        Url: "https://media.example/b.jpg",
      });
      expect(store.auctionLinks.get("sale-1")).toMatchObject({
        atgAuctionId: "atg-auction-1",
        atgAuctionReference: "sale-1",
        remoteStatus: "created",
        lastSyncedAt: NOW,
        lastError: null,
      });
      expect(store.lotLinks.get("lot-1")).toMatchObject({
        atgLotId: "atg-lot-1",
        imageNames: ["1", "1-1"],
        lastError: null,
      });
    });

    it("makes no ATG writes when nothing changed", async () => {
      await service.pushSale("sale-1");
      gateway.calls.length = 0;

      const summary = await service.pushSale("sale-1");

      expect(summary).toEqual({ created: 0, updated: 0, unchanged: 2, deleted: 0, failed: 0 });
      expect(gateway.ops()).toEqual([]);
    });

    it("updates only the auction and lots whose payload changed", async () => {
      await service.pushSale("sale-1");
      gateway.calls.length = 0;
      const sale = store.sales.get("sale-1");
      if (!sale) throw new Error("missing sale");
      store.sales.set("sale-1", {
        ...sale,
        title: "Renamed sale",
        lots: [{ ...(sale.lots[0] ?? testLot()), title: "New title" }, ...sale.lots.slice(1)],
      });

      const summary = await service.pushSale("sale-1");

      expect(summary).toMatchObject({ updated: 1, unchanged: 1 });
      expect(gateway.ops()).toEqual(["updateAuction", "updateLot"]);
      expect(gateway.calls[0]?.arg).toMatchObject({
        AuctionId: "atg-auction-1",
        Title: "Renamed sale",
      });
      expect(gateway.calls[1]?.arg).toMatchObject({ LotId: "atg-lot-1", Title: "New title" });
    });

    it("never re-sends images once ATG has some, but sends them when a lot had none", async () => {
      await service.pushSale("sale-1");
      gateway.calls.length = 0;
      const sale = store.sales.get("sale-1");
      if (!sale) throw new Error("missing sale");
      store.sales.set("sale-1", {
        ...sale,
        lots: sale.lots.map((l) => ({ ...l, images: ["new.jpg"] })),
      });

      await service.pushSale("sale-1");

      expect(gateway.calls).toEqual([
        {
          op: "addLotImageUrl",
          arg: { LotId: "atg-lot-2", ImageName: "1", Url: "https://media.example/new.jpg" },
        },
      ]);
    });

    it("deletes ATG lots for lots removed from the sale", async () => {
      await service.pushSale("sale-1");
      gateway.calls.length = 0;
      const sale = store.sales.get("sale-1");
      if (!sale) throw new Error("missing sale");
      store.sales.set("sale-1", { ...sale, lots: sale.lots.slice(0, 1) });

      const summary = await service.pushSale("sale-1");

      expect(summary).toMatchObject({ deleted: 1, unchanged: 1 });
      expect(gateway.calls).toEqual([{ op: "deleteLot", arg: "atg-lot-2" }]);
      expect(store.lotLinks.has("lot-2")).toBe(false);
    });

    it("keeps going after a rejected lot and reports which lot failed", async () => {
      store.sales.set(
        "sale-1",
        testSale({
          lots: [
            testLot({ id: "lot-1", lotNumber: null, title: "No number" }),
            testLot({ id: "lot-2", lotNumber: 2, images: [] }),
          ],
        }),
      );

      const summary = await service.pushSale("sale-1");

      expect(summary).toMatchObject({ created: 1, failed: 1 });
      expect(store.lotLinks.has("lot-1")).toBe(false);
      expect(store.auctionLinks.get("sale-1")?.lastError).toBe(
        'Lot "No number": Lot number is required before the lot can be sent to ATG',
      );
      expect(store.auctionLinks.get("sale-1")?.lastSyncedAt).toEqual(NOW);
    });

    it("records a permanent ATG rejection on the lot link without failing the job", async () => {
      await service.pushSale("sale-1");
      const sale = store.sales.get("sale-1");
      if (!sale) throw new Error("missing sale");
      store.sales.set("sale-1", {
        ...sale,
        lots: [{ ...(sale.lots[0] ?? testLot()), title: "Changed" }, ...sale.lots.slice(1)],
      });
      gateway.failNext("updateLot", rejected("updateLot"));

      const summary = await service.pushSale("sale-1");

      expect(summary.failed).toBe(1);
      expect(store.lotLinks.get("lot-1")?.lastError).toBe(
        "ATG updateLot failed with HTTP 400: invalid",
      );
    });

    it("throws a retryable partial error on transient lot failures and retries cleanly", async () => {
      gateway.failNext("createLot", transient("createLot"));

      await expect(service.pushSale("sale-1")).rejects.toBeInstanceOf(AtgPartialSyncError);
      expect(store.auctionLinks.get("sale-1")?.lastSyncedAt).toBeNull();

      gateway.calls.length = 0;
      const summary = await service.pushSale("sale-1");

      expect(gateway.ops()).toEqual(["createLot", "addLotImageUrl", "addLotImageUrl"]);
      expect(summary).toMatchObject({ created: 1, unchanged: 1, failed: 0 });
    });

    it("records image progress so a failed image upload resumes without duplicates", async () => {
      gateway.failNext("addLotImageUrl", transient("addLotImageUrl"), 1);

      await expect(service.pushSale("sale-1")).rejects.toBeInstanceOf(AtgPartialSyncError);
      expect(store.lotLinks.get("lot-1")?.imageNames).toEqual(["1"]);

      gateway.calls.length = 0;
      await service.pushSale("sale-1");

      expect(gateway.calls).toEqual([
        {
          op: "addLotImageUrl",
          arg: { LotId: "atg-lot-1", ImageName: "1-1", Url: "https://media.example/b.jpg" },
        },
      ]);
      expect(store.lotLinks.get("lot-1")?.imageNames).toEqual(["1", "1-1"]);
    });

    it("appends images added in LAX after the first push", async () => {
      await service.pushSale("sale-1");
      gateway.calls.length = 0;
      const sale = store.sales.get("sale-1");
      if (!sale) throw new Error("missing sale");
      store.sales.set("sale-1", {
        ...sale,
        lots: [
          { ...(sale.lots[0] ?? testLot()), images: ["a.jpg", "b.jpg", "c.jpg"] },
          ...sale.lots.slice(1),
        ],
      });

      await service.pushSale("sale-1");

      expect(gateway.calls).toEqual([
        {
          op: "addLotImageUrl",
          arg: { LotId: "atg-lot-1", ImageName: "1-2", Url: "https://media.example/c.jpg" },
        },
      ]);
    });

    it("stores the error and rethrows when the auction itself cannot be created", async () => {
      gateway.failNext("createAuction", rejected("createAuction"));

      await expect(service.pushSale("sale-1")).rejects.toMatchObject({ retryable: false });
      expect(store.auctionLinks.get("sale-1")).toMatchObject({
        atgAuctionId: null,
        lastError: "ATG createAuction failed with HTTP 400: invalid",
      });
    });

    it("refuses to touch closed auctions or missing sales", async () => {
      await expect(service.pushSale("missing")).rejects.toBeInstanceOf(AtgSyncPreconditionError);
      await store.saveAuctionLink("sale-1", { atgAuctionId: "a", remoteStatus: "closed" });
      await expect(service.pushSale("sale-1")).rejects.toBeInstanceOf(AtgSyncPreconditionError);
    });
  });

  describe("publish and close", () => {
    it("publishes once, approving first only when configured", async () => {
      build({ approveBeforePublish: true });

      await service.publishSale("sale-1");
      await service.publishSale("sale-1");

      expect(gateway.ops().filter((op) => op.endsWith("Auction"))).toEqual([
        "createAuction",
        "approveAuction",
        "publishAuction",
      ]);
      expect(store.auctionLinks.get("sale-1")).toMatchObject({
        remoteStatus: "published",
        publishedAt: NOW,
      });
    });

    it("closes and immediately polls results", async () => {
      await service.pushSale("sale-1");
      gateway.calls.length = 0;

      await service.closeSale("sale-1");

      expect(gateway.ops()).toEqual(["closeAuction", "getLots", "getSaleResults"]);
      expect(store.auctionLinks.get("sale-1")).toMatchObject({
        remoteStatus: "closed",
        closedAt: NOW,
      });
    });

    it("rejects publish/close for sales never pushed", async () => {
      await expect(service.closeSale("sale-1")).rejects.toBeInstanceOf(AtgSyncPreconditionError);
    });
  });

  describe("pollSale", () => {
    it("writes remote lot state and the results snapshot", async () => {
      await service.pushSale("sale-1");
      gateway.remoteLots = [
        {
          atgLotId: "atg-lot-1",
          lotNumber: "1",
          status: 2,
          sold: true,
          hammerPrice: 1500,
          currentMaxBid: 1500,
          numberOfBids: 7,
          winningBidderId: "bidder-1",
          endTimeUtc: null,
        },
      ];
      gateway.saleResults = [
        {
          atgLotId: "atg-lot-1",
          lotNumber: "1",
          lotStatus: "Sold",
          numberOfBids: 7,
          paddleNumber: "1042",
          hammerPrice: 1500,
          totalHammerPrice: 1500,
          endTimeUtc: null,
        },
      ];

      await service.pollSale("sale-1");

      expect(store.lotLinks.get("lot-1")).toMatchObject({ sold: true, hammerPrice: 1500 });
      expect(store.auctionLinks.get("sale-1")).toMatchObject({
        lastPolledAt: NOW,
        resultsSnapshot: gateway.saleResults,
      });
    });

    it("records poll failures on the auction link", async () => {
      await service.pushSale("sale-1");
      gateway.failNext("getLots", transient("getLots"));

      await expect(service.pollSale("sale-1")).rejects.toMatchObject({ retryable: true });
      expect(store.auctionLinks.get("sale-1")?.lastError).toBe(
        "Poll failed: ATG getLots failed with HTTP 503: busy",
      );
    });
  });

  describe("tick", () => {
    it("re-pushes edited linked sales and polls published ones, isolating failures", async () => {
      await service.publishSale("sale-1");
      store.sales.set("sale-2", testSale({ id: "sale-2", lots: [] }));
      await service.publishSale("sale-2");
      store.changedSales = new Set(["sale-1", "sale-2"]);
      gateway.calls.length = 0;
      gateway.failNext("getLots", transient("getLots"));

      const result = await service.tick();

      expect(result).toEqual({ pushed: 2, polled: 1, failed: 1 });
      expect(gateway.ops()).toContain("getSaleResults");
    });

    it("skips untouched unpublished sales", async () => {
      await service.pushSale("sale-1");
      gateway.calls.length = 0;

      expect(await service.tick()).toEqual({ pushed: 0, polled: 0, failed: 0 });
      expect(gateway.ops()).toEqual([]);
    });
  });
});
