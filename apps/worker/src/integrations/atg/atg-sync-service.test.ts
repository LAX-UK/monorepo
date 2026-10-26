import { beforeEach, describe, expect, it } from "vitest";
import { testAtgConfig, testLot, testSale } from "./__fixtures__/atg-snapshots.js";
import {
  FakeAtgGateway,
  FakeAtgImageInspector,
  InMemoryAtgSyncStore,
} from "./__fixtures__/fakes.js";
import { AtgGatewayError, type AtgRemoteLot } from "./atg-gateway.js";
import {
  AWAITING_ATG_APPROVAL_MESSAGE,
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

function remoteLot(atgLotId: string): AtgRemoteLot {
  return {
    atgLotId,
    lotNumber: null,
    status: 1,
    sold: false,
    hammerPrice: null,
    currentMaxBid: null,
    numberOfBids: 0,
    winningBidderId: null,
    endTimeUtc: null,
  };
}

describe("AtgSyncService", () => {
  let gateway: FakeAtgGateway;
  let store: InMemoryAtgSyncStore;
  let images: FakeAtgImageInspector;
  let service: AtgSyncService;

  function build(config: Partial<AtgSyncConfig> = {}) {
    service = new AtgSyncService({
      gateway,
      store,
      imageInspector: images,
      config: { ...testAtgConfig, ...config },
      now: () => NOW,
    });
  }

  beforeEach(() => {
    gateway = new FakeAtgGateway();
    store = new InMemoryAtgSyncStore();
    images = new FakeAtgImageInspector();
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
      expect(gateway.calls[1]?.arg).toMatchObject({
        AuctionId: "atg-auction-1",
        LotNumber: "1",
      });
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
      expect(gateway.calls[1]?.arg).not.toHaveProperty("Status");
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

      expect(gateway.ops()).toEqual(["getLots", "createLot", "addLotImageUrl", "addLotImageUrl"]);
      expect(summary).toMatchObject({ created: 1, unchanged: 1, failed: 0 });
    });

    it("adopts an ATG lot whose create response was lost instead of creating a duplicate", async () => {
      gateway.failNext("createLot", transient("createLot"));
      await expect(service.pushSale("sale-1")).rejects.toBeInstanceOf(AtgPartialSyncError);
      gateway.remoteLots = [
        { ...remoteLot("atg-lot-2"), lotNumber: "2" },
        { ...remoteLot("atg-lot-orphan"), lotNumber: "1" },
      ];
      gateway.calls.length = 0;

      const summary = await service.pushSale("sale-1");

      expect(gateway.ops()).toEqual(["getLots", "updateLot", "addLotImageUrl", "addLotImageUrl"]);
      expect(gateway.calls[1]?.arg).toMatchObject({ LotId: "atg-lot-orphan", LotNumber: "1" });
      expect(store.lotLinks.get("lot-1")).toMatchObject({
        atgLotId: "atg-lot-orphan",
        imageNames: ["1", "1-1"],
      });
      expect(summary).toMatchObject({ updated: 1, unchanged: 1, failed: 0 });
    });

    it("removes the old ATG copy of a lot moved here from another pushed sale", async () => {
      await store.insertLotLink({
        lotId: "lot-2",
        saleId: "sale-old",
        atgLotId: "atg-old",
        payloadHash: "x",
        lockedFieldsHash: "x",
      });

      const summary = await service.pushSale("sale-1");

      expect(gateway.calls.slice(0, 2)).toEqual([
        expect.objectContaining({ op: "createAuction" }),
        { op: "deleteLot", arg: "atg-old" },
      ]);
      expect(store.lotLinks.get("lot-2")).toMatchObject({ saleId: "sale-1" });
      expect(summary).toMatchObject({ created: 2, failed: 0 });
    });

    it("skips a moved lot when its old ATG copy cannot be removed", async () => {
      await store.insertLotLink({
        lotId: "lot-2",
        saleId: "sale-old",
        atgLotId: "atg-old",
        payloadHash: "x",
        lockedFieldsHash: "x",
      });
      gateway.failNext("deleteLot", rejected("deleteLot"));

      const summary = await service.pushSale("sale-1");

      expect(summary).toMatchObject({ created: 1, failed: 1 });
      expect(store.lotLinks.get("lot-2")).toMatchObject({
        saleId: "sale-old",
        lastError: "ATG deleteLot failed with HTTP 400: invalid",
      });
      expect(store.auctionLinks.get("sale-1")?.lastError).toBe(
        "Moved lot atg-old: ATG deleteLot failed with HTTP 400: invalid",
      );
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

    it("refuses a lot with an image ATG can't take before writing anything for it", async () => {
      images.facts.set("https://media.example/b.jpg", {
        contentType: "image/png",
        bytes: 1_000,
        error: null,
      });

      const summary = await service.pushSale("sale-1");

      expect(summary).toMatchObject({ created: 1, failed: 1 });
      expect(gateway.ops().filter((op) => op === "createLot")).toHaveLength(1);
      expect(store.lotLinks.has("lot-1")).toBe(false);
      expect(store.auctionLinks.get("sale-1")?.lastError).toBe(
        "Lot 1: ATG can't take this lot's images: image 2 must be a JPG (is image/png)",
      );
    });

    it("checks only images that are not on ATG yet", async () => {
      await service.pushSale("sale-1");
      images.inspected.length = 0;

      await service.pushSale("sale-1");

      expect(images.inspected).toEqual([]);
    });

    describe("after bidding starts", () => {
      async function editLot1(edit: Partial<ReturnType<typeof testLot>>) {
        const sale = store.sales.get("sale-1");
        const lot = sale?.lots[0];
        if (!sale || !lot) throw new Error("fixture missing");
        store.sales.set("sale-1", { ...sale, lots: [{ ...lot, ...edit }, ...sale.lots.slice(1)] });
      }

      beforeEach(async () => {
        await service.publishSale("sale-1");
        await store.applyRemoteLots(
          "sale-1",
          [{ ...remoteLot("atg-lot-1"), numberOfBids: 2 }],
          NOW,
        );
        gateway.calls.length = 0;
      });

      it("refuses edits to fields ATG locks, without calling ATG", async () => {
        await editLot1({ reservePrice: "900.00" });

        const summary = await service.pushSale("sale-1");

        expect(summary).toMatchObject({ failed: 1, unchanged: 1 });
        expect(gateway.ops()).not.toContain("updateLot");
        expect(store.lotLinks.get("lot-1")?.lastError).toMatch(/has bids on ATG/);
      });

      it("still sends edits ATG allows, re-sending locked fields unchanged", async () => {
        await editLot1({ endTime: new Date("2026-11-01T19:00:00Z") });

        const summary = await service.pushSale("sale-1");

        expect(summary).toMatchObject({ updated: 1, failed: 0 });
        expect(gateway.calls.find((c) => c.op === "updateLot")?.arg).toMatchObject({
          LotId: "atg-lot-1",
          Reserve: 800,
          EndTimeUtc: "2026-11-01T19:00:00.000Z",
        });
      });
    });

    it("stores the error and rethrows when the auction itself cannot be created", async () => {
      gateway.failNext("createAuction", rejected("createAuction"));

      await expect(service.pushSale("sale-1")).rejects.toMatchObject({ retryable: false });
      expect(store.auctionLinks.get("sale-1")).toMatchObject({
        atgAuctionId: null,
        lastError: "ATG createAuction failed with HTTP 400: invalid",
      });
    });

    it("does not auto-retry a create ATG may have processed, to avoid duplicate auctions", async () => {
      gateway.failNext("createAuction", transient("createAuction"));

      const err = await service.pushSale("sale-1").catch((e: unknown) => e);

      expect(err).toBeInstanceOf(AtgSyncPreconditionError);
      expect(store.auctionLinks.get("sale-1")?.lastError).toBe(
        'ATG did not confirm the new auction (ATG createAuction failed with HTTP 503: busy). ATG has no auction for this sale from the last day. Check the ATG admin for "Autumn Contemporary" before pushing again, to avoid a duplicate.',
      );
    });

    describe("a create whose reply was lost", () => {
      const lost = (id = "sale-1") => ({
        atgAuctionId: "atg-found",
        clientsAuctionId: id,
        isApproved: false,
        isPublished: false,
        statusCode: 0,
      });

      it("adopts the auction ATG made and carries on with its lots", async () => {
        gateway.failNext("createAuction", transient("createAuction"));
        gateway.clientAuctions = [{ ...lost("other-sale"), atgAuctionId: "atg-other" }, lost()];

        const summary = await service.pushSale("sale-1");

        expect(summary).toMatchObject({ created: 2, failed: 0 });
        expect(gateway.calls.find((c) => c.op === "findAuctionsByClientId")?.arg).toEqual({
          clientId: "client-1",
          fromDate: new Date(NOW.getTime() - 24 * 60 * 60 * 1000),
        });
        expect(store.auctionLinks.get("sale-1")).toMatchObject({
          atgAuctionId: "atg-found",
          atgAuctionReference: "sale-1",
          remoteStatus: "created",
          lastError: null,
        });
        expect(gateway.calls.find((c) => c.op === "createLot")?.arg).toMatchObject({
          AuctionId: "atg-found",
        });
      });

      it("says so when the lookup itself fails", async () => {
        gateway.failNext("createAuction", transient("createAuction"));
        gateway.failNext("findAuctionsByClientId", transient("findAuctionsByClientId"));

        await expect(service.pushSale("sale-1")).rejects.toBeInstanceOf(AtgSyncPreconditionError);
        expect(store.auctionLinks.get("sale-1")?.lastError).toContain(
          "Looking for it on ATG also failed (ATG findAuctionsByClientId failed with HTTP 503: busy)",
        );
      });

      it("keeps the plain error and skips the lookup without a client id", async () => {
        build({ clientId: null });
        gateway.failNext("createAuction", transient("createAuction"));

        await expect(service.pushSale("sale-1")).rejects.toBeInstanceOf(AtgSyncPreconditionError);
        expect(gateway.ops()).not.toContain("findAuctionsByClientId");
        expect(store.auctionLinks.get("sale-1")?.lastError).toBe(
          'ATG did not confirm the new auction (ATG createAuction failed with HTTP 503: busy). Check the ATG admin for "Autumn Contemporary" before pushing again, to avoid a duplicate.',
        );
      });

      it("adopts the earlier auction on a later push instead of creating a duplicate", async () => {
        gateway.failNext("createAuction", transient("createAuction"));
        gateway.failNext("findAuctionsByClientId", transient("findAuctionsByClientId"));
        await service.pushSale("sale-1").catch(() => undefined);
        gateway.clientAuctions = [lost()];
        gateway.calls.length = 0;

        await service.pushSale("sale-1");

        expect(gateway.ops()).not.toContain("createAuction");
        expect(gateway.calls.find((c) => c.op === "findAuctionsByClientId")?.arg).toEqual({
          clientId: "client-1",
          fromDate: new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000),
        });
        expect(gateway.ops()).toContain("updateAuction");
        expect(store.auctionLinks.get("sale-1")).toMatchObject({
          atgAuctionId: "atg-found",
          lastError: null,
        });
      });

      it("stops a later push when the earlier attempt can't be checked", async () => {
        gateway.failNext("createAuction", transient("createAuction"));
        gateway.failNext("findAuctionsByClientId", transient("findAuctionsByClientId"));
        await service.pushSale("sale-1").catch(() => undefined);
        gateway.failNext("findAuctionsByClientId", transient("findAuctionsByClientId"));
        gateway.calls.length = 0;

        await expect(service.pushSale("sale-1")).rejects.toBeInstanceOf(AtgSyncPreconditionError);
        expect(gateway.ops()).not.toContain("createAuction");
      });
    });

    it("refuses cancelled sales and stops the tick from re-pushing them", async () => {
      await service.pushSale("sale-1");
      const sale = store.sales.get("sale-1");
      if (!sale) throw new Error("missing sale");
      store.sales.set("sale-1", { ...sale, cancelled: true });
      gateway.calls.length = 0;

      await expect(service.pushSale("sale-1")).rejects.toBeInstanceOf(AtgSyncPreconditionError);
      expect(gateway.ops()).toEqual([]);
      expect(store.auctionLinks.get("sale-1")).toMatchObject({
        lastSyncedAt: NOW,
        lastError: "Sale is cancelled in LAX, so it is no longer pushed. Close it on ATG.",
      });
    });

    it("refuses to touch closed auctions or missing sales", async () => {
      await expect(service.pushSale("missing")).rejects.toBeInstanceOf(AtgSyncPreconditionError);
      await store.saveAuctionLink("sale-1", { atgAuctionId: "a", remoteStatus: "closed" });
      await expect(service.pushSale("sale-1")).rejects.toBeInstanceOf(AtgSyncPreconditionError);
    });
  });

  describe("publish and close", () => {
    it("publishes once and never approves on ATG's behalf", async () => {
      await service.publishSale("sale-1");
      await service.publishSale("sale-1");

      expect(gateway.ops().filter((op) => op.endsWith("Auction"))).toEqual([
        "createAuction",
        "publishAuction",
      ]);
      expect(store.auctionLinks.get("sale-1")).toMatchObject({
        remoteStatus: "published",
        publishedAt: NOW,
      });
    });

    it("explains that ATG staff must approve when ATG rejects the publish", async () => {
      gateway.failNext("publishAuction", rejected("publishAuction"));

      await expect(service.publishSale("sale-1")).rejects.toMatchObject({ retryable: false });

      expect(store.auctionLinks.get("sale-1")).toMatchObject({
        remoteStatus: "created",
        lastError: `${AWAITING_ATG_APPROVAL_MESSAGE} (ATG publishAuction failed with HTTP 400: invalid)`,
      });
    });

    it("keeps transient publish failures as plain errors so the job retries", async () => {
      gateway.failNext("publishAuction", transient("publishAuction"));

      await expect(service.publishSale("sale-1")).rejects.toMatchObject({ retryable: true });
      expect(store.auctionLinks.get("sale-1")?.lastError).toBe(
        "ATG publishAuction failed with HTTP 503: busy",
      );
    });

    it("does not publish while any lot failed to sync", async () => {
      gateway.failNext("createLot", rejected("createLot"));

      await expect(service.publishSale("sale-1")).rejects.toBeInstanceOf(AtgSyncPreconditionError);

      expect(gateway.ops()).not.toContain("publishAuction");
      expect(store.auctionLinks.get("sale-1")).toMatchObject({
        remoteStatus: "created",
        lastError:
          "Not published: fix these lots first. Lot 1: ATG createLot failed with HTTP 400: invalid",
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
      expect(gateway.ops()).toEqual(["getAuction"]);
    });

    describe("approval on ATG", () => {
      const remote = (patch: { isApproved?: boolean; isPublished?: boolean }) => ({
        atgAuctionId: "atg-auction-1",
        clientsAuctionId: "sale-1",
        isApproved: false,
        isPublished: false,
        statusCode: 0,
        ...patch,
      });

      it("records when ATG staff approved a pushed auction, once", async () => {
        await service.pushSale("sale-1");
        gateway.remoteAuctions.set("atg-auction-1", remote({ isApproved: true }));

        await service.tick();
        expect(store.auctionLinks.get("sale-1")).toMatchObject({
          approvedAt: NOW,
          remoteStatus: "created",
        });

        const later = new Date(NOW.getTime() + 60_000);
        service = new AtgSyncService({
          gateway,
          store,
          imageInspector: images,
          config: testAtgConfig,
          now: () => later,
        });
        await service.tick();
        expect(store.auctionLinks.get("sale-1")?.approvedAt).toEqual(NOW);
      });

      it("leaves an unapproved auction untouched", async () => {
        await service.pushSale("sale-1");
        gateway.remoteAuctions.set("atg-auction-1", remote({}));

        await service.tick();

        expect(store.auctionLinks.get("sale-1")).toMatchObject({
          approvedAt: null,
          remoteStatus: "created",
        });
      });

      it("marks the auction published when staff published it in Toolbox", async () => {
        await service.pushSale("sale-1");
        gateway.remoteAuctions.set(
          "atg-auction-1",
          remote({ isApproved: true, isPublished: true }),
        );

        await service.tick();

        expect(store.auctionLinks.get("sale-1")).toMatchObject({
          remoteStatus: "published",
          publishedAt: NOW,
          approvedAt: NOW,
        });
      });

      it("does not ask ATG about auctions that are already published", async () => {
        await service.publishSale("sale-1");
        gateway.calls.length = 0;

        await service.tick();

        expect(gateway.ops()).not.toContain("getAuction");
      });

      it("reports a failed lookup for that sale and carries on", async () => {
        await service.pushSale("sale-1");
        gateway.failNext("getAuction", transient("getAuction"));

        expect(await service.tick()).toMatchObject({ failed: 1 });
      });
    });

    it("re-pushes a sale whose last sync failed even without catalogue changes", async () => {
      await service.pushSale("sale-1");
      await store.saveAuctionLink("sale-1", { lastError: "ATG updateAuction failed" });
      gateway.calls.length = 0;

      expect(await service.tick()).toMatchObject({ pushed: 1, failed: 0 });
      expect(store.auctionLinks.get("sale-1")?.lastError).toBeNull();
    });

    it("leaves sales published on lax.bid alone", async () => {
      await service.pushSale("sale-1");
      const sale = store.sales.get("sale-1");
      if (!sale) throw new Error("fixture missing");
      store.sales.set("sale-1", { ...sale, saleStatus: "scheduled" });
      store.changedSales = new Set(["sale-1"]);
      gateway.calls.length = 0;

      expect(await service.tick()).toEqual({ pushed: 0, polled: 0, failed: 0 });
      expect(gateway.ops()).toEqual([]);
    });

    it("reports each failing sale and carries on", async () => {
      const errors: Array<[string, unknown]> = [];
      service = new AtgSyncService({
        gateway,
        store,
        imageInspector: images,
        config: testAtgConfig,
        now: () => NOW,
        onTickError: (saleId, err) => errors.push([saleId, err]),
      });
      await service.publishSale("sale-1");
      gateway.failNext("getLots", transient("getLots"));

      expect(await service.tick()).toMatchObject({ failed: 1 });
      expect(errors).toEqual([["sale-1", expect.objectContaining({ retryable: true })]]);
    });
  });

  describe("one platform per sale", () => {
    it("refuses to create an ATG auction for a sale published on lax.bid", async () => {
      const sale = store.sales.get("sale-1");
      if (!sale) throw new Error("fixture missing");
      store.sales.set("sale-1", { ...sale, saleStatus: "scheduled" });

      await expect(service.pushSale("sale-1")).rejects.toBeInstanceOf(AtgSyncPreconditionError);
      expect(gateway.ops()).not.toContain("createAuction");
    });

    it("re-checks ownership before publishing on ATG", async () => {
      await service.pushSale("sale-1");
      const sale = store.sales.get("sale-1");
      if (!sale) throw new Error("fixture missing");
      store.sales.set("sale-1", { ...sale, saleStatus: "scheduled" });
      gateway.calls.length = 0;

      await expect(service.publishSale("sale-1")).rejects.toBeInstanceOf(AtgSyncPreconditionError);
      expect(gateway.ops()).not.toContain("publishAuction");
    });

    it("refuses banded buyer's premium before calling ATG", async () => {
      const sale = store.sales.get("sale-1");
      if (!sale) throw new Error("fixture missing");
      store.sales.set("sale-1", {
        ...sale,
        buyerPremiumTiers: [{ hammerThresholdMinor: 100_000, rate: "0.25" }],
      });

      await expect(service.pushSale("sale-1")).rejects.toThrow(
        "ATG needs a single flat buyer's premium; remove the bands.",
      );
      expect(gateway.ops()).toEqual([]);
    });
  });

  describe("pollSale error recovery", () => {
    it("clears its own poll error after a successful poll but keeps push errors", async () => {
      await service.publishSale("sale-1");
      gateway.failNext("getLots", transient("getLots"));
      await expect(service.pollSale("sale-1")).rejects.toBeDefined();

      await service.pollSale("sale-1");
      expect(store.auctionLinks.get("sale-1")?.lastError).toBeNull();

      await store.saveAuctionLink("sale-1", { lastError: "lot 2: rejected" });
      await service.pollSale("sale-1");
      expect(store.auctionLinks.get("sale-1")?.lastError).toBe("lot 2: rejected");
    });
  });
});
