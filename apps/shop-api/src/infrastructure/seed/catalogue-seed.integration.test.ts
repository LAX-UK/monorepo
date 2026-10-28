import { shopArtist, shopArtwork, shopEdition, shopHomePlacement } from "@auction/db/schema";
import { assertEditionFacts } from "@auction/shop-domain";
import { asc, eq, inArray } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPublishedArtworkImportWriter } from "../../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../../test-support/shop-integration-setup.js";
import { createDrizzleEditionFactsRepository } from "../drizzle-edition-facts.repository.js";
import { createDrizzleEditionRunRepository } from "../drizzle-edition-run.repository.js";
import { createDrizzleSaleAuthorityWriter } from "../drizzle-sale-authority.writer.js";
import { ART_SEED_ORIGINAL_SLUGS, seedShopFoundationCatalogue } from "./catalogue-seed.js";

describe.skipIf(!hasShopIntegrationDb)("foundation catalogue seed", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  it("seeds lax.art originals on the art sales channel with a medium (idempotent)", async () => {
    const db = createShopDb(shopPool);
    const importWriter = createPublishedArtworkImportWriter(db, "off");
    const authorityWriter = createDrizzleSaleAuthorityWriter(db, "off");
    const seed = () =>
      seedShopFoundationCatalogue(
        importWriter.importArtwork.bind(importWriter),
        db,
        authorityWriter.grantSaleAuthority.bind(authorityWriter),
      );

    await seed();
    await seed();

    const rows = await db
      .select({
        slug: shopArtwork.slug,
        salesChannel: shopArtwork.salesChannel,
        medium: shopArtwork.medium,
        objectType: shopArtwork.objectType,
        heightCm: shopArtwork.heightCm,
      })
      .from(shopArtwork)
      .where(inArray(shopArtwork.slug, [...ART_SEED_ORIGINAL_SLUGS]));

    expect(rows).toHaveLength(ART_SEED_ORIGINAL_SLUGS.length);
    for (const row of rows) {
      expect(row.salesChannel).toBe("art");
      expect(row.medium).toBeTruthy();
      expect(row.objectType).toBeTruthy();
      expect(Number(row.heightCm)).toBeGreaterThan(0);
    }
    expect(new Set(rows.map((row) => row.objectType)).size).toBeGreaterThanOrEqual(4);

    const featured = await db
      .select({ slug: shopArtist.slug, position: shopHomePlacement.position })
      .from(shopHomePlacement)
      .innerJoin(shopArtist, eq(shopArtist.id, shopHomePlacement.artistId))
      .where(eq(shopHomePlacement.slot, "featured_artists"));
    expect(featured.map((row) => row.slug)).toEqual(
      expect.arrayContaining(["art-foundation-artist", "theo-marsh", "ines-okafor"]),
    );
    expect(featured.every((row) => row.position < 8)).toBe(true);
  });

  it("links one on-sale and one sold-out Shop edition to a lax.art original (idempotent)", async () => {
    const db = createShopDb(shopPool);
    const importWriter = createPublishedArtworkImportWriter(db, "off");
    const authorityWriter = createDrizzleSaleAuthorityWriter(db, "off");
    const seed = () =>
      seedShopFoundationCatalogue(
        importWriter.importArtwork.bind(importWriter),
        db,
        authorityWriter.grantSaleAuthority.bind(authorityWriter),
      );
    await seed();
    await seed();

    const [original] = await db
      .select({ id: shopArtwork.id })
      .from(shopArtwork)
      .where(eq(shopArtwork.slug, "harbour-light"));
    const editions = await db
      .select({ slug: shopArtwork.slug, channel: shopArtwork.salesChannel })
      .from(shopArtwork)
      .where(eq(shopArtwork.sourceOriginalArtworkId, original?.id ?? ""));
    expect(editions.map((edition) => edition.slug).sort()).toEqual([
      "harbour-light-edition",
      "harbour-light-edition-large",
    ]);
    expect(editions.every((edition) => edition.channel === "shop")).toBe(true);
  });

  it("seeds confirmed facts and custom, open, proof and companion runs (idempotent)", async () => {
    const db = createShopDb(shopPool);
    const importWriter = createPublishedArtworkImportWriter(db, "off");
    const authorityWriter = createDrizzleSaleAuthorityWriter(db, "off");
    const seed = () =>
      seedShopFoundationCatalogue(
        importWriter.importArtwork.bind(importWriter),
        db,
        authorityWriter.grantSaleAuthority.bind(authorityWriter),
      );
    await seed();
    await seed();

    const runs = createDrizzleEditionRunRepository(db);
    const facts = createDrizzleEditionFactsRepository(db);
    const idOf = async (slug: string) => {
      const [row] = await db
        .select({ id: shopArtwork.id })
        .from(shopArtwork)
        .where(eq(shopArtwork.slug, slug));
      return row?.id ?? "";
    };
    const run = async (slug: string) => (await runs.getRun(await idOf(slug)))?.spec;
    const printsOf = async (slug: string) =>
      db
        .select()
        .from(shopEdition)
        .where(eq(shopEdition.artworkId, await idOf(slug)))
        .orderBy(asc(shopEdition.stockRef));

    expect(await run("vessel-study")).toEqual({ type: "lax_standard" });
    expect(await run("harbour-at-dusk")).toEqual({ type: "lax_standard" });
    expect(await run("composition-1964")).toMatchObject({ type: "custom_limited", size: 40 });
    expect(await run("shoreline-estate")).toMatchObject({ type: "custom_limited", size: 12 });
    expect(await run("night-garden")).toMatchObject({ type: "open" });
    expect(await run("harbour-at-dusk-artists-proof")).toMatchObject({
      type: "proof",
      proofType: "ap",
      size: 3,
      mainRunId: await idOf("harbour-at-dusk"),
    });
    expect(await run("harbour-at-dusk-unsigned")).toMatchObject({
      type: "companion",
      mainRunId: await idOf("harbour-at-dusk"),
    });

    expect(await printsOf("harbour-at-dusk")).toHaveLength(24);
    expect(await printsOf("composition-1964")).toHaveLength(40);
    expect(await printsOf("shoreline-estate")).toHaveLength(12);
    const garden = await printsOf("night-garden");
    expect(garden.map((print) => print.stockRef)).toEqual(
      Array.from({ length: 30 }, (_, i) => i + 1),
    );
    expect(garden.every((print) => print.editionNumber === null)).toBe(true);
    expect(garden.filter((print) => print.custodyStatus === "stored")).toHaveLength(20);
    expect(
      garden.filter((print) => print.custodyStatus === "stored").every((print) => print.labelCode),
    ).toBe(true);
    expect(await runs.listStockBatches(await idOf("night-garden"))).toHaveLength(2);
    const proofs = await printsOf("harbour-at-dusk-artists-proof");
    expect(proofs.map((print) => print.proofNumber)).toEqual([1, 2, 3]);
    expect(proofs.every((print) => print.editionNumber === null)).toBe(true);

    for (const slug of [
      "harbor-print",
      "vessel-study",
      "reed-study",
      "harbour-at-dusk",
      "composition-1964",
      "shoreline-estate",
      "night-garden",
      "harbour-at-dusk-artists-proof",
      "harbour-at-dusk-unsigned",
    ]) {
      const recorded = await facts.getFacts(await idOf(slug));
      expect(recorded?.confirmed, slug).not.toBeNull();
      const spec = await run(slug);
      expect(spec).toBeDefined();
      if (recorded && spec) assertEditionFacts(spec, recorded);
    }
  });
});
