import type { Database } from "@auction/db";
import {
  shopArtwork,
  shopEdition,
  shopOrder,
  shopOrderLine,
  shopOriginalSale,
  shopParty,
} from "@auction/db/schema";
import type { AdminEditionFacts, AdminNewRunInput } from "@auction/shop-contracts";
import { ShopDomainError } from "@auction/shop-domain";
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
import { ensureLaxShopParty } from "../ensure-lax-party.js";
import { createDrizzleOriginalSaleWriter } from "../phase/drizzle-original-sale.writer.js";
import { reserveEditionsForCheckoutOrder } from "../shop-checkout-reservation.js";
import { createShopDomainEventPublisher } from "../shop-domain-event-publisher.js";
import { createDrizzleEditionRunUnitOfWork } from "./drizzle-edition-run.unit-of-work.js";

const ACTOR = "edition-runs-it-staff";
const key = () => `idem-${integrationSuffix("er")}`;
const resolveMediaUrl = (value: string | null | undefined) => (value ? `/${value}` : null);
const UNSIGNED: AdminEditionFacts = {
  numbering: "none",
  signature: { kind: "unsigned" },
  certificate: { kind: "none" },
};

describe.skipIf(!hasShopIntegrationDb)("edition runs end to end", { timeout: 60_000 }, () => {
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
      }),
      artists: createDrizzleArtistCatalogueWriter(uow),
      reader: createDrizzleAdminArtworkReader(db, { resolveMediaUrl }),
      authority: createDrizzleSaleAuthorityWriter(db, "off"),
    };
  }

  async function artist(label: string) {
    const { artists } = setup();
    return artists.createArtist({
      displayName: `Artist ${label}`,
      slug: `it-er-artist-${integrationSuffix(label)}`,
      discipline: null,
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    });
  }

  async function newArtwork(
    label: string,
    run: AdminNewRunInput | null,
    options: { artistId?: string; sourceOriginalArtworkId?: string } = {},
  ) {
    const { writer } = setup();
    const artistId = options.artistId ?? (await artist(label)).artistId;
    const created = await writer.createArtwork({
      slug: `it-er-${integrationSuffix(label)}`,
      title: `Run ${label}`,
      artistId,
      yearCreated: 2025,
      medium: "Giclée",
      dimensions: null,
      description: null,
      run,
      printPricePence: run ? 42_000 : null,
      saleState: run ? "for_sale" : "price_on_application",
      salesChannel: run ? "shop" : "art",
      images: [],
      ...(options.sourceOriginalArtworkId
        ? { sourceOriginalArtworkId: options.sourceOriginalArtworkId }
        : {}),
      seoTitle: null,
      seoDescription: null,
      canSetPrice: true,
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    });
    return { ...created, artistId };
  }

  async function detail(artworkId: string) {
    return requireDefined(await setup().reader.getArtwork(artworkId), "detail");
  }

  async function artistParty(artworkId: string) {
    const [row] = await db
      .select({ ownerPartyId: shopEdition.ownerPartyId })
      .from(shopEdition)
      .where(and(eq(shopEdition.artworkId, artworkId), eq(shopEdition.allocation, "artist")))
      .limit(1);
    return requireDefined(row?.ownerPartyId, "artist party");
  }

  it("creates each template with its prints, and reads the run back for the editor", async () => {
    const standard = await newArtwork("std", { spec: { type: "lax_standard" } });
    expect((await detail(standard.artworkId)).editions.byAllocation).toEqual({
      original_buyer_entitlement: 10,
      artist: 10,
      lax: 4,
    });
    const custom = await newArtwork("custom", {
      spec: { type: "custom_limited", size: 40, allocation: { buyer: 0, artist: 30, lax: 10 } },
      proofsKept: { ap: 3, pp: 1, hc: 0, bat: 0 },
    });
    const customDetail = await detail(custom.artworkId);
    expect(customDetail.editions.size).toBe(40);
    expect(customDetail.run?.spec).toMatchObject({ type: "custom_limited", size: 40 });
    expect(customDetail.run?.proofsKept.ap).toBe(3);
    const open = await newArtwork("open", {
      spec: { type: "open", defaultArtistPct: 50 },
      facts: UNSIGNED,
      factsConfirmed: true,
      firstBatch: { artistCount: 10, laxCount: 10, custody: "unprinted" },
    });
    const openDetail = await detail(open.artworkId);
    expect(openDetail.run?.stock).toMatchObject({ onSale: 10, toPrint: 20, nextStockRef: 21 });
    expect(openDetail.run?.stock?.batches).toHaveLength(1);
    expect(openDetail.run?.factsConfirmed?.at).toBeTruthy();
  });

  it("blocks publishing until the facts are confirmed", async () => {
    const { writer, services } = setup();
    const artwork = await newArtwork("publish", { spec: { type: "lax_standard" } });
    expect((await detail(artwork.artworkId)).publishBlockers).toContain("edition_facts_incomplete");
    await db
      .update(shopEdition)
      .set({ listingStatus: "not_authorised" })
      .where(eq(shopEdition.artworkId, artwork.artworkId));
    const publish = () =>
      writer.setVisibility({
        artworkId: artwork.artworkId,
        action: "publish",
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
      });
    await expect(publish()).rejects.toThrow(ShopDomainError);
    await services.facts.save({
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
      artworkId: artwork.artworkId,
      facts: editionFactsInput(UNSIGNED),
      confirmed: true,
      expectedFactsVersion: null,
    });
    const blockers = (await detail(artwork.artworkId)).publishBlockers;
    expect(blockers).not.toContain("edition_facts_incomplete");
  });

  it("fixes the size once a print is offered, and caps sale authority at the prints held", async () => {
    const { services, authority } = setup();
    const artwork = await newArtwork("lock", {
      spec: { type: "custom_limited", size: 40, allocation: { buyer: 0, artist: 30, lax: 10 } },
    });
    const ownerPartyId = await artistParty(artwork.artworkId);
    await expect(
      authority.grantSaleAuthority({
        artworkId: artwork.artworkId,
        ownerPartyId,
        authorisedCount: 31,
        evidenceNote: "too many",
        recordedBySubjectId: ACTOR,
      }),
    ).rejects.toThrow("You can offer at most 30 prints");
    const granted = await authority.grantSaleAuthority({
      artworkId: artwork.artworkId,
      ownerPartyId,
      authorisedCount: 30,
      evidenceNote: "all of the artist's share",
      recordedBySubjectId: ACTOR,
    });
    expect(granted.authorisedCount).toBe(30);
    const after = await detail(artwork.artworkId);
    expect(after.run?.locks).toEqual({ sizeAndAllocationLocked: true, factsLocked: false });
    await expect(
      services.runs.replace({
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
        artworkId: artwork.artworkId,
        run: { type: "lax_standard" },
        proofsKept: { ap: 0, pp: 0, hc: 0, bat: 0 },
        expectedVersion: after.version,
      }),
    ).rejects.toThrow("Prints have been offered for sale, so the run is fixed");
  });

  it("authorises unnumbered open edition prints by stock reference", async () => {
    const { authority } = setup();
    const artwork = await newArtwork("open-authority", {
      spec: { type: "open", defaultArtistPct: 50 },
      firstBatch: { artistCount: 4, laxCount: 0, custody: "stored", storageLocation: "Chest A" },
    });
    const ownerPartyId = await artistParty(artwork.artworkId);
    const granted = await authority.grantSaleAuthority({
      artworkId: artwork.artworkId,
      ownerPartyId,
      authorisedCount: 3,
      evidenceNote: "three open edition prints",
      recordedBySubjectId: ACTOR,
    });
    expect(granted.editionNumbersAuthorised).toEqual([1, 2, 3]);
  });

  it("never sells more open edition prints than are on sale, under concurrent checkouts", async () => {
    const artwork = await newArtwork("oversell", {
      spec: { type: "open", defaultArtistPct: 0 },
      firstBatch: { artistCount: 0, laxCount: 3, custody: "stored", storageLocation: "Chest B" },
    });
    // Only a live artwork sells; publishing itself is covered above.
    await db
      .update(shopArtwork)
      .set({ publishedAt: new Date() })
      .where(eq(shopArtwork.id, artwork.artworkId));
    const events = createShopDomainEventPublisher("off");
    const orderIds: string[] = [];
    const attempts = await Promise.allSettled(
      Array.from({ length: 6 }, async (_, index) => {
        const [order] = await db
          .insert(shopOrder)
          .values({
            identitySubjectId: `subject-oversell-${index}-${Date.now()}`,
            fulfilment: "collect_brunswick",
            merchandiseSubtotalPence: 42_000,
            fulfilmentSurchargePence: 0,
            totalPence: 42_000,
            idempotencyKey: `idem-oversell-${integrationSuffix(String(index))}`,
            status: "pending_payment",
          })
          .returning({ id: shopOrder.id });
        orderIds.push(requireDefined(order?.id, "order"));
        await db.transaction((tx) =>
          reserveEditionsForCheckoutOrder(
            tx as unknown as Database,
            {
              orderId: requireDefined(order?.id, "order"),
              reservedUntil: new Date(Date.now() + 60_000),
              expandedLines: [{ artworkId: artwork.artworkId, unitPricePence: 42_000 }],
            },
            events,
          ),
        );
      }),
    );
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(3);
    const refused = attempts.filter((attempt) => attempt.status === "rejected");
    expect(refused).toHaveLength(3);
    for (const attempt of refused) {
      expect((attempt as PromiseRejectedResult).reason).toBeInstanceOf(ShopApiError);
    }
    const reserved = await db
      .select({ stockRef: shopEdition.stockRef })
      .from(shopEdition)
      .where(
        and(
          eq(shopEdition.artworkId, artwork.artworkId),
          eq(shopEdition.listingStatus, "reserved"),
        ),
      );
    expect(reserved.map((row) => row.stockRef).sort()).toEqual([1, 2, 3]);
    // Leave no order on unnumbered prints behind: the migration suites roll back afterwards.
    await db
      .update(shopEdition)
      .set({ listingStatus: "authorised", reservedByOrderId: null })
      .where(eq(shopEdition.artworkId, artwork.artworkId));
    await db.delete(shopOrderLine).where(inArray(shopOrderLine.orderId, orderIds));
    await db.delete(shopOrder).where(inArray(shopOrder.id, orderIds));
  });

  it("gives the original's buyer every buyer print of the runs made from it", async () => {
    const { artistId } = await artist("original");
    const original = await newArtwork("the-original", null, { artistId });
    const run = await newArtwork(
      "from-original",
      {
        spec: { type: "custom_limited", size: 30, allocation: { buyer: 12, artist: 12, lax: 6 } },
      },
      { artistId, sourceOriginalArtworkId: original.artworkId },
    );
    const [buyer] = await db
      .insert(shopParty)
      .values({ displayName: `Buyer ${integrationSuffix("b")}`, kind: "person" })
      .returning({ id: shopParty.id });
    const buyerPartyId = requireDefined(buyer?.id, "buyer");
    await ensureLaxShopParty(db);
    const sales = createDrizzleOriginalSaleWriter({
      db,
      uow: createDrizzleShopUnitOfWork(db, "off"),
      invoiceGateway: {
        createAndFinalizeOriginalSaleInvoice: async () => {
          throw new Error("not used");
        },
      },
      domainEventMode: "off",
    });
    const { originalSaleId } = await sales.createReservation({
      artworkId: original.artworkId,
      buyerPartyId,
      salePricePence: 1_200_000,
      actorSubjectId: ACTOR,
    });
    await db
      .update(shopOriginalSale)
      .set({ status: "invoiced" })
      .where(eq(shopOriginalSale.id, originalSaleId));
    await sales.completePaidAndAssign({
      originalSaleId,
      stripeInvoiceId: "in_test",
      paidAt: new Date(),
    });
    const owned = await db
      .select({ stockRef: shopEdition.stockRef })
      .from(shopEdition)
      .where(
        and(eq(shopEdition.artworkId, run.artworkId), eq(shopEdition.ownerPartyId, buyerPartyId)),
      );
    expect(owned).toHaveLength(12);
  });
});
