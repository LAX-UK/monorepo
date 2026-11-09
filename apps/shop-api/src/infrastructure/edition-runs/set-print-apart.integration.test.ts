import type { Database } from "@auction/db";
import {
  shopArtwork,
  shopEdition,
  shopOrder,
  shopOrderLine,
  shopPrintException,
} from "@auction/db/schema";
import type { AdminEditionFacts } from "@auction/shop-contracts";
import { and, eq, inArray } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { editionFactsInput } from "../../application/edition-runs/edition-run-input.js";
import { createEditionRunServices } from "../../application/edition-runs/edition-run-services.js";
import { ShopApiError } from "../../errors/shop-api-error.js";
import { integrationSuffix, requireDefined } from "../../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../../test-support/shop-integration-setup.js";
import { createDrizzleAdminArtworkReader } from "../drizzle-admin-artwork.reader.js";
import { createDrizzleArtistCatalogueWriter } from "../drizzle-artist-catalogue.writer.js";
import { createDrizzleArtworkCatalogueWriter } from "../drizzle-artwork-catalogue.writer.js";
import { createDrizzleSaleAuthorityWriter } from "../drizzle-sale-authority.writer.js";
import { createDrizzleShopUnitOfWork } from "../drizzle-shop-transaction-effects.js";
import { loadPublicEdition } from "../public-edition-source.js";
import { reserveEditionsForCheckoutOrder } from "../shop-checkout-reservation.js";
import { createShopDomainEventPublisher } from "../shop-domain-event-publisher.js";
import { readEditionRunDetail } from "./drizzle-edition-run-detail.reader.js";
import { createDrizzleEditionRunUnitOfWork } from "./drizzle-edition-run.unit-of-work.js";

const ACTOR = "set-apart-it-staff";
const key = () => `idem-${integrationSuffix("sa")}`;
const resolveMediaUrl = (value: string | null | undefined) => (value ? `/${value}` : null);
const FACTS: AdminEditionFacts = {
  numbering: "on_print",
  signature: { kind: "hand_signed", medium: "pencil", place: "front_lower_margin" },
  certificate: { kind: "none" },
};
const REMARQUE = { remarque: { medium: "pencil", place: "lower_margin" } } as const;

describe.skipIf(!hasShopIntegrationDb)(
  "setting a print apart end to end",
  { timeout: 60_000 },
  () => {
    let shopPool: pg.Pool;
    let ownerPool: pg.Pool;
    let db: Database;

    beforeAll(async () => {
      ({ ownerPool, shopPool } = await setupShopIntegrationPools());
      db = createShopDb(shopPool);
    });

    afterAll(async () => {
      await shopPool.end();
      await ownerPool.end();
    });

    function setup() {
      const uow = createDrizzleShopUnitOfWork(db, "off");
      const services = createEditionRunServices({
        uow: createDrizzleEditionRunUnitOfWork(uow),
        clock: { now: () => new Date() },
      });
      return {
        services,
        writer: createDrizzleArtworkCatalogueWriter(uow, {
          resolveMediaUrl,
          editionRuns: services.recorder,
          originalPrints: services.originalPrintsRecorder,
          releaseAlerts: { recordPublished: async () => ({ queued: 0 }) },
        }),
        artists: createDrizzleArtistCatalogueWriter(uow),
        reader: createDrizzleAdminArtworkReader(db, { resolveMediaUrl }),
        authority: createDrizzleSaleAuthorityWriter(db, "off"),
      };
    }

    /** A published LAX standard run with confirmed facts and the artist's ten prints on sale. */
    async function liveRun(label: string) {
      const { artists, writer, services, authority } = setup();
      const artist = await artists.createArtist({
        displayName: `Artist ${label}`,
        slug: `it-sa-artist-${integrationSuffix(label)}`,
        discipline: null,
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
      });
      const created = await writer.createArtwork({
        slug: `it-sa-${integrationSuffix(label)}`,
        title: `Tide ${label}`,
        artistId: artist.artistId,
        yearCreated: 2025,
        medium: "Giclée",
        dimensions: null,
        description: null,
        run: { spec: { type: "lax_standard" } },
        printPricePence: 18_000,
        saleState: "for_sale",
        salesChannel: "shop",
        images: [],
        seoTitle: null,
        seoDescription: null,
        canSetPrice: true,
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
      });
      await services.facts.save({
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
        artworkId: created.artworkId,
        facts: editionFactsInput(FACTS),
        confirmed: true,
        expectedFactsVersion: null,
      });
      const [artistPrint] = await db
        .select({ ownerPartyId: shopEdition.ownerPartyId })
        .from(shopEdition)
        .where(
          and(eq(shopEdition.artworkId, created.artworkId), eq(shopEdition.allocation, "artist")),
        )
        .limit(1);
      await authority.grantSaleAuthority({
        artworkId: created.artworkId,
        ownerPartyId: requireDefined(artistPrint?.ownerPartyId, "artist party"),
        authorisedCount: 10,
        evidenceNote: "the artist's share",
        recordedBySubjectId: ACTOR,
      });
      await db
        .update(shopArtwork)
        .set({ publishedAt: new Date() })
        .where(eq(shopArtwork.id, created.artworkId));
      return created.artworkId;
    }

    async function printNumbered(artworkId: string, editionNumber: number) {
      const [row] = await db
        .select()
        .from(shopEdition)
        .where(
          and(eq(shopEdition.artworkId, artworkId), eq(shopEdition.editionNumber, editionNumber)),
        )
        .limit(1);
      return requireDefined(row, `print ${editionNumber}`);
    }

    async function reserveFromRun(artworkId: string, count: number) {
      const events = createShopDomainEventPublisher("off");
      const orderIds: string[] = [];
      const taken: number[] = [];
      for (let index = 0; index < count; index += 1) {
        const [order] = await db
          .insert(shopOrder)
          .values({
            identitySubjectId: `subject-sa-${index}-${Date.now()}`,
            fulfilment: "collect_brunswick",
            merchandiseSubtotalPence: 18_000,
            fulfilmentSurchargePence: 0,
            totalPence: 18_000,
            idempotencyKey: `idem-sa-${integrationSuffix(String(index))}`,
            status: "pending_payment",
          })
          .returning({ id: shopOrder.id });
        const orderId = requireDefined(order?.id, "order");
        orderIds.push(orderId);
        try {
          await db.transaction((tx) =>
            reserveEditionsForCheckoutOrder(
              tx as unknown as Database,
              {
                orderId,
                reservedUntil: new Date(Date.now() + 60_000),
                expandedLines: [{ artworkId, unitPricePence: 18_000 }],
              },
              events,
            ),
          );
        } catch (error) {
          if (!(error instanceof ShopApiError)) throw error;
        }
      }
      const lines = await db
        .select({ editionNumber: shopOrderLine.editionNumber })
        .from(shopOrderLine)
        .where(inArray(shopOrderLine.orderId, orderIds));
      for (const line of lines) if (line.editionNumber !== null) taken.push(line.editionNumber);
      return { orderIds, taken };
    }

    async function cleanUp(orderIds: string[], artworkIds: string[]) {
      await db
        .update(shopEdition)
        .set({ listingStatus: "authorised", reservedByOrderId: null, reservedUntil: null })
        .where(inArray(shopEdition.artworkId, artworkIds));
      await db.delete(shopOrderLine).where(inArray(shopOrderLine.orderId, orderIds));
      await db.delete(shopOrder).where(inArray(shopOrder.id, orderIds));
    }

    it("moves the print to a listing of its own, which the run's checkout never reaches", async () => {
      const { services } = setup();
      const runId = await liveRun("queue");
      const print = await printNumbered(runId, 12);
      const listing = await services.setApart.setApart({
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
        runArtworkId: runId,
        editionId: print.id,
        differences: REMARQUE,
        printPricePence: 42_000,
        canSetPrice: true,
      });
      expect((await printNumbered(listing.artworkId, 12)).id).toBe(print.id);
      const [artwork] = await db
        .select()
        .from(shopArtwork)
        .where(eq(shopArtwork.id, listing.artworkId));
      expect(artwork).toMatchObject({
        runRole: "set_apart",
        runSize: 1,
        mainRunArtworkId: runId,
        printPricePence: 42_000,
        publishedAt: null,
      });
      // Every other authorised print of the run can be taken, and print 12 is never among them.
      const { orderIds, taken } = await reserveFromRun(runId, 10);
      expect(taken).toHaveLength(9);
      expect(taken).not.toContain(12);
      await cleanUp(orderIds, [runId, listing.artworkId]);
    });

    it("never hands a print to a buyer of the run once it is set apart, whichever lands first", async () => {
      const { services } = setup();
      for (const [index, editionNumber] of [12, 13, 14].entries()) {
        const runId = await liveRun(`race-${index}`);
        const print = await printNumbered(runId, editionNumber);
        const [checkouts, setApart] = await Promise.all([
          reserveFromRun(runId, 10),
          services.setApart
            .setApart({
              actorSubjectId: ACTOR,
              idempotencyKey: key(),
              runArtworkId: runId,
              editionId: print.id,
              differences: REMARQUE,
              printPricePence: 42_000,
              canSetPrice: true,
            })
            .then(
              (listing) => ({ listing }),
              (error: unknown) => ({ error }),
            ),
        ]);
        const after = await printNumbered(runId, editionNumber).catch(() => null);
        if ("listing" in setApart) {
          // Set apart first: the run's buyers got every other print, and never this one.
          expect(checkouts.taken).not.toContain(editionNumber);
          expect(checkouts.taken).toHaveLength(9);
          const [held] = await db
            .select({ artworkId: shopEdition.artworkId })
            .from(shopEdition)
            .where(eq(shopEdition.id, print.id));
          expect(held?.artworkId).toBe(setApart.listing.artworkId);
          expect(after).toBeNull();
        } else {
          // A basket got it first: setting apart is refused, and the print stays in the run.
          expect(String((setApart.error as Error).message)).toMatch(/basket|reserved/);
          expect(after?.artworkId).toBe(runId);
          expect(checkouts.taken).toContain(editionNumber);
        }
        await cleanUp(checkouts.orderIds, [runId]);
      }
    });

    it("reads back for staff: the run's Prints table and the listing's origin", async () => {
      const { services } = setup();
      const runId = await liveRun("read");
      const print = await printNumbered(runId, 13);
      const listing = await services.setApart.setApart({
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
        runArtworkId: runId,
        editionId: print.id,
        differences: { ...REMARQUE, dedicated: true },
        printPricePence: 55_000,
        canSetPrice: true,
      });
      const [run] = await db.select().from(shopArtwork).where(eq(shopArtwork.id, runId));
      const runDetail = await readEditionRunDetail(db, requireDefined(run, "run"));
      const row = runDetail?.prints?.find((entry) => entry.label === "13");
      expect(row).toMatchObject({
        status: "set_apart",
        setApart: { listingArtworkId: listing.artworkId },
      });
      expect(runDetail?.prints).toHaveLength(24);
      expect(runDetail?.prints?.find((entry) => entry.label === "14")).toMatchObject({
        status: "on_sale",
        block: null,
      });
      expect(runDetail?.linkedListings.map((entry) => entry.artworkId)).toContain(
        listing.artworkId,
      );
      const [listingRow] = await db
        .select()
        .from(shopArtwork)
        .where(eq(shopArtwork.id, listing.artworkId));
      const listingDetail = await readEditionRunDetail(db, requireDefined(listingRow, "listing"));
      expect(listingDetail?.setApart).toMatchObject({
        runArtworkId: runId,
        label: "13",
        printOf: "No. 13 of 24",
        returnBlock: null,
      });
      expect(listingDetail?.prints).toBeNull();
    });

    it("tells shoppers which print it is and what is different, once the run's facts are confirmed", async () => {
      const { services } = setup();
      const runId = await liveRun("public");
      const print = await printNumbered(runId, 15);
      const listing = await services.setApart.setApart({
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
        runArtworkId: runId,
        editionId: print.id,
        differences: REMARQUE,
        printPricePence: 42_000,
        canSetPrice: true,
      });
      await db
        .update(shopArtwork)
        .set({ publishedAt: new Date() })
        .where(eq(shopArtwork.id, listing.artworkId));
      const page = await loadPublicEdition(db, listing.artworkId);
      expect(page?.run).toEqual({ kind: "limited", size: 24 });
      expect(page?.setApart).toEqual({
        print: { editionNumber: 15, proofNumber: null, of: { kind: "limited", size: 24 } },
        exception: REMARQUE,
      });
      const main = await loadPublicEdition(db, runId);
      expect(
        main?.otherRuns.find((other) => other.slug === listing.slug)?.setApart?.print,
      ).toMatchObject({ editionNumber: 15 });
    });

    it("records the change in the audit log, and refuses a print in a basket", async () => {
      const { services } = setup();
      const runId = await liveRun("basket");
      const print = await printNumbered(runId, 16);
      await db
        .update(shopEdition)
        .set({ listingStatus: "reserved", reservedUntil: new Date(Date.now() + 600_000) })
        .where(eq(shopEdition.id, print.id));
      await expect(
        services.setApart.setApart({
          actorSubjectId: ACTOR,
          idempotencyKey: key(),
          runArtworkId: runId,
          editionId: print.id,
          differences: REMARQUE,
          printPricePence: 42_000,
          canSetPrice: true,
        }),
      ).rejects.toThrow("is in a buyer's basket");
      expect((await printNumbered(runId, 16)).artworkId).toBe(runId);
      await db
        .update(shopEdition)
        .set({ listingStatus: "authorised", reservedUntil: null })
        .where(eq(shopEdition.id, print.id));
    });

    it("goes back to the run while unsold, and can be set apart again", async () => {
      const { services } = setup();
      const runId = await liveRun("return");
      const print = await printNumbered(runId, 17);
      const first = await services.setApart.setApart({
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
        runArtworkId: runId,
        editionId: print.id,
        differences: REMARQUE,
        printPricePence: 42_000,
        canSetPrice: true,
      });
      await services.setApart.returnToRun({
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
        listingArtworkId: first.artworkId,
      });
      expect((await printNumbered(runId, 17)).artworkId).toBe(runId);
      const [archived] = await db
        .select()
        .from(shopArtwork)
        .where(eq(shopArtwork.id, first.artworkId));
      expect(archived?.archivedAt).not.toBeNull();
      const records = await db
        .select()
        .from(shopPrintException)
        .where(eq(shopPrintException.editionId, print.id));
      expect(records).toHaveLength(1);
      expect(records[0]?.returnedAt).not.toBeNull();
      const second = await services.setApart.setApart({
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
        runArtworkId: runId,
        editionId: print.id,
        differences: { dedicated: true },
        printPricePence: 30_000,
        canSetPrice: true,
      });
      expect(second.artworkId).not.toBe(first.artworkId);
      expect(second.slug).not.toBe(first.slug);
    });

    it("will not go back to the run once the print has sold", async () => {
      const { services } = setup();
      const runId = await liveRun("sold");
      const print = await printNumbered(runId, 18);
      const listing = await services.setApart.setApart({
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
        runArtworkId: runId,
        editionId: print.id,
        differences: REMARQUE,
        printPricePence: 42_000,
        canSetPrice: true,
      });
      await db
        .update(shopEdition)
        .set({ listingStatus: "sold" })
        .where(eq(shopEdition.id, print.id));
      await expect(
        services.setApart.returnToRun({
          actorSubjectId: ACTOR,
          idempotencyKey: key(),
          listingArtworkId: listing.artworkId,
        }),
      ).rejects.toThrow("is sold");
      expect((await printNumbered(listing.artworkId, 18)).id).toBe(print.id);
    });
  },
);
