import type { Database } from "@auction/db";
import { shopArtist, shopArtwork, shopEdition, shopParty } from "@auction/db/schema";
import type { EditionFacts, EditionRunSpec, ProofsKept } from "@auction/shop-domain";
import { asc, eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPublishedArtworkImportWriter } from "../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleEditionFactsRepository } from "./drizzle-edition-facts.repository.js";
import { createDrizzleEditionRunRepository } from "./drizzle-edition-run.repository.js";
import { insertEditionRun } from "./insert-planned-editions.js";

const NONE: ProofsKept = { ap: 0, pp: 0, hc: 0, bat: 0 };
const IMAGE = "/shop/home/artwork-warm-basket.webp";

const custom = (
  size: number,
  allocation: { buyer: number; artist: number; lax: number },
  linkedToOriginal = false,
): EditionRunSpec => ({ type: "custom_limited", size, allocation, linkedToOriginal });

describe.skipIf(!hasShopIntegrationDb)("edition run and facts repositories", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;
  let db: Database;
  const suffix = `${Date.now()}`;
  let counter = 0;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
    db = createShopDb(shopPool);
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  async function importArtwork(
    options: { artist?: string; eligible?: boolean; image?: string } = {},
  ) {
    counter += 1;
    const label = `run-${suffix}-${counter}`;
    const { artworkId } = await createPublishedArtworkImportWriter(db, "off").importArtwork({
      importKey: `integration:${label}`,
      slug: `integration-${label}`,
      title: `Run ${label}`,
      description: null,
      primaryImageUrl: options.image ?? IMAGE,
      artistSlug: options.artist ?? `integration-artist-${label}`,
      artistDisplayName: "Integration Artist",
      eligibleForEditionAllocation: options.eligible ?? false,
      printPricePence: 5_000,
    });
    return artworkId;
  }

  async function artistOf(artworkId: string): Promise<string> {
    const [row] = await db
      .select({ artistId: shopArtwork.artistId })
      .from(shopArtwork)
      .where(eq(shopArtwork.id, artworkId));
    if (!row) throw new Error("artwork missing");
    return row.artistId;
  }

  async function createRun(artworkId: string, run: EditionRunSpec): Promise<number> {
    const artistId = await artistOf(artworkId);
    return db.transaction((tx) =>
      insertEditionRun(tx as unknown as Database, { artworkId, artistId, run }),
    );
  }

  const editionsOf = (artworkId: string) =>
    db
      .select()
      .from(shopEdition)
      .where(eq(shopEdition.artworkId, artworkId))
      .orderBy(asc(shopEdition.stockRef));

  describe("runs", () => {
    it("records the LAX standard run when an artwork with editions is created", async () => {
      const runs = createDrizzleEditionRunRepository(db);
      const artworkId = await importArtwork({ eligible: true });
      expect(await runs.getRun(artworkId)).toEqual({
        artworkId,
        spec: { type: "lax_standard" },
        proofsKept: NONE,
      });
      const prints = await editionsOf(artworkId);
      expect(prints).toHaveLength(24);
      expect(prints.map((row) => row.editionNumber)).toEqual(prints.map((row) => row.stockRef));
      expect(prints.filter((row) => row.allocation === "original_buyer_entitlement")).toHaveLength(
        10,
      );
      expect(prints.filter((row) => row.allocation === "artist")).toHaveLength(10);
      expect(prints.filter((row) => row.allocation === "lax")).toHaveLength(4);
    });

    it("reads an original as having no run", async () => {
      const runs = createDrizzleEditionRunRepository(db);
      expect(await runs.getRun(await importArtwork({ eligible: false }))).toBeNull();
    });

    it("creates a custom run's prints with their owners and numbers", async () => {
      const runs = createDrizzleEditionRunRepository(db);
      const artworkId = await importArtwork();
      const spec = custom(12, { buyer: 0, artist: 8, lax: 4 });
      expect(await createRun(artworkId, spec)).toBe(12);
      const prints = await editionsOf(artworkId);
      expect(prints.map((row) => row.editionNumber)).toEqual(
        Array.from({ length: 12 }, (_, i) => i + 1),
      );
      expect(prints.slice(0, 8).every((row) => row.allocation === "artist")).toBe(true);
      expect(prints.slice(8).every((row) => row.allocation === "lax")).toBe(true);
      expect(prints.every((row) => row.ownerPartyId !== null)).toBe(true);
      expect((await runs.getRun(artworkId))?.spec).toEqual(spec);
    });

    it("saves a changed run and the proofs kept, and reads them back", async () => {
      const runs = createDrizzleEditionRunRepository(db);
      const artworkId = await importArtwork();
      const spec = custom(40, { buyer: 0, artist: 30, lax: 10 });
      const proofsKept = { ap: 3, pp: 1, hc: 0, bat: 1 };
      await runs.saveRun(artworkId, { spec, proofsKept });
      expect(await runs.getRun(artworkId)).toEqual({ artworkId, spec, proofsKept });
    });

    it("refuses a run that breaks a rule, and a database rule the caller did not check", async () => {
      const runs = createDrizzleEditionRunRepository(db);
      const artworkId = await importArtwork();
      await expect(
        runs.saveRun(artworkId, {
          spec: custom(1, { buyer: 0, artist: 1, lax: 0 }),
          proofsKept: NONE,
        }),
      ).rejects.toThrow("between 2 and 500");
      // The domain says buyer prints are fine when linked; the artwork has no original, so the
      // adapter stops it before the database check does.
      await expect(
        runs.saveRun(artworkId, {
          spec: custom(10, { buyer: 4, artist: 3, lax: 3 }, true),
          proofsKept: NONE,
        }),
      ).rejects.toThrow("Buyer prints need an original");
      expect(await runs.getRun(artworkId)).toBeNull();
    });

    it("lists a proof listing and a companion against their main run", async () => {
      const runs = createDrizzleEditionRunRepository(db);
      const artist = `integration-linked-artist-${suffix}`;
      const main = await importArtwork({ artist });
      await runs.saveRun(main, {
        spec: custom(24, { buyer: 0, artist: 16, lax: 8 }),
        proofsKept: { ap: 3, pp: 0, hc: 0, bat: 0 },
      });
      const proof = await importArtwork({ artist });
      const proofSpec: EditionRunSpec = {
        type: "proof",
        proofType: "ap",
        size: 3,
        owner: "artist",
        mainRunId: main,
        proofsKeptOnMain: 3,
      };
      await runs.saveRun(proof, { spec: proofSpec, proofsKept: NONE });
      expect((await runs.getRun(proof))?.spec).toEqual(proofSpec);

      const companion = await importArtwork({ artist });
      const companionSpec: EditionRunSpec = {
        type: "companion",
        mainRunId: main,
        run: { type: "open", defaultSplit: { artistPct: 50, laxPct: 50 } },
      };
      await runs.saveRun(companion, { spec: companionSpec, proofsKept: NONE });
      expect((await runs.getRun(companion))?.spec).toEqual(companionSpec);
    });

    it("refuses a proof listing larger than the proofs the main run kept, whatever the caller read", async () => {
      const runs = createDrizzleEditionRunRepository(db);
      const artist = `integration-proof-artist-${suffix}`;
      const main = await importArtwork({ artist });
      await runs.saveRun(main, {
        spec: custom(24, { buyer: 0, artist: 16, lax: 8 }),
        proofsKept: { ap: 2, pp: 0, hc: 0, bat: 0 },
      });
      const proof = await importArtwork({ artist });
      await expect(
        runs.saveRun(proof, {
          spec: {
            type: "proof",
            proofType: "ap",
            size: 3,
            owner: "artist",
            mainRunId: main,
            proofsKeptOnMain: 99,
          },
          proofsKept: NONE,
        }),
      ).rejects.toThrow("kept 2");
    });

    it("refuses to link to another artist's run, a different image, or a proof", async () => {
      const runs = createDrizzleEditionRunRepository(db);
      const artist = `integration-link-artist-${suffix}`;
      const main = await importArtwork({ artist });
      await runs.saveRun(main, {
        spec: custom(24, { buyer: 0, artist: 16, lax: 8 }),
        proofsKept: { ap: 3, pp: 0, hc: 0, bat: 0 },
      });
      const companionOf = (mainRunId: string): EditionRunSpec => ({
        type: "companion",
        mainRunId,
        run: { type: "lax_standard" },
      });
      const otherArtist = await importArtwork();
      await expect(
        runs.saveRun(otherArtist, { spec: companionOf(main), proofsKept: NONE }),
      ).rejects.toThrow("same artist");
      const otherImage = await importArtwork({ artist, image: "/shop/home/original-2.webp" });
      await expect(
        runs.saveRun(otherImage, { spec: companionOf(main), proofsKept: NONE }),
      ).rejects.toThrow("same image");
      const proof = await importArtwork({ artist });
      await runs.saveRun(proof, {
        spec: {
          type: "proof",
          proofType: "ap",
          size: 1,
          owner: "artist",
          mainRunId: main,
          proofsKeptOnMain: 3,
        },
        proofsKept: NONE,
      });
      const another = await importArtwork({ artist });
      await expect(
        runs.saveRun(another, { spec: companionOf(proof), proofsKept: NONE }),
      ).rejects.toThrow("linked to a proof");
    });
  });

  describe("open edition stock", () => {
    const open: EditionRunSpec = { type: "open", defaultSplit: { artistPct: 50, laxPct: 50 } };

    async function openArtwork() {
      const artworkId = await importArtwork();
      expect(await createRun(artworkId, open)).toBe(0);
      return artworkId;
    }

    it("adds unnumbered prints in batches, split between the artist and LAX", async () => {
      const runs = createDrizzleEditionRunRepository(db);
      const artworkId = await openArtwork();
      const first = await runs.addStockBatch({
        artworkId,
        artistCount: 6,
        laxCount: 4,
        custodyStatus: "stored",
        storageLocation: "  Plan chest B, drawer 3 ",
        addedBySubjectId: "staff-1",
      });
      const second = await runs.addStockBatch({
        artworkId,
        artistCount: 0,
        laxCount: 5,
        custodyStatus: "unprinted",
        storageLocation: "ignored while unprinted",
        addedBySubjectId: "staff-2",
      });
      expect(first).toMatchObject({
        firstStockRef: 1,
        quantity: 10,
        artistCount: 6,
        laxCount: 4,
        custodyStatus: "stored",
        storageLocation: "Plan chest B, drawer 3",
      });
      expect(second).toMatchObject({
        firstStockRef: 11,
        quantity: 5,
        storageLocation: null,
        addedBySubjectId: "staff-2",
      });
      const prints = await editionsOf(artworkId);
      expect(prints.map((row) => row.stockRef)).toEqual(
        Array.from({ length: 15 }, (_, i) => i + 1),
      );
      expect(prints.every((row) => row.editionNumber === null)).toBe(true);
      expect(prints.every((row) => row.listingStatus === "not_authorised")).toBe(true);
      expect(prints.slice(0, 10).map((row) => row.custodyStatus)).toEqual(Array(10).fill("stored"));
      expect(prints[0]?.storageLocation).toBe("Plan chest B, drawer 3");
      expect(prints.slice(10).every((row) => row.allocation === "lax")).toBe(true);
      const [artist] = await db
        .select({ partyId: shopArtist.partyId })
        .from(shopArtist)
        .innerJoin(shopArtwork, eq(shopArtwork.artistId, shopArtist.id))
        .where(eq(shopArtwork.id, artworkId));
      const [lax] = await db
        .select({ id: shopParty.id })
        .from(shopParty)
        .where(eq(shopParty.kind, "lax"));
      for (const print of prints) {
        expect(print.ownerPartyId).toBe(print.allocation === "lax" ? lax?.id : artist?.partyId);
      }
      expect((await runs.listStockBatches(artworkId)).map((batch) => batch.id)).toEqual([
        first.id,
        second.id,
      ]);
    });

    it("never gives two batches the same stock references, even when added together", async () => {
      const runs = createDrizzleEditionRunRepository(db);
      const artworkId = await openArtwork();
      const results = await Promise.all(
        [1, 2, 3, 4].map((n) =>
          runs.addStockBatch({
            artworkId,
            artistCount: n,
            laxCount: 1,
            custodyStatus: "unprinted",
            addedBySubjectId: `staff-${n}`,
          }),
        ),
      );
      const refs = (await editionsOf(artworkId)).map((row) => row.stockRef);
      expect(new Set(refs).size).toBe(refs.length);
      expect(refs).toEqual(Array.from({ length: refs.length }, (_, i) => i + 1));
      expect(new Set(results.map((batch) => batch.firstStockRef)).size).toBe(4);
    });

    it("only stocks an open edition, and refuses an empty batch", async () => {
      const runs = createDrizzleEditionRunRepository(db);
      const limited = await importArtwork({ eligible: true });
      await expect(
        runs.addStockBatch({
          artworkId: limited,
          artistCount: 1,
          laxCount: 0,
          custodyStatus: "unprinted",
          addedBySubjectId: "staff-1",
        }),
      ).rejects.toThrow("open edition");
      const artworkId = await openArtwork();
      await expect(
        runs.addStockBatch({
          artworkId,
          artistCount: 0,
          laxCount: 0,
          custodyStatus: "unprinted",
          addedBySubjectId: "staff-1",
        }),
      ).rejects.toThrow("at least one print");
      expect(await runs.listStockBatches(artworkId)).toEqual([]);
    });
  });

  describe("facts", () => {
    const handSigned: EditionFacts = {
      numbering: "on_print",
      signature: { kind: "hand_signed", medium: "pencil", place: "front_lower_margin" },
      certificate: {
        kind: "included",
        issuer: "artist",
        form: "paper",
        arrives: { kind: "with_print" },
        numberedToMatch: true,
      },
      confirmed: { by: "staff-1", at: new Date("2026-10-28T09:00:00Z") },
    };

    it("reads no facts until some are saved, then replaces them", async () => {
      const facts = createDrizzleEditionFactsRepository(db);
      const artworkId = await importArtwork({ eligible: true });
      expect(await facts.getFacts(artworkId)).toBeNull();
      await facts.saveFacts(artworkId, handSigned);
      expect(await facts.getFacts(artworkId)).toEqual(handSigned);
      const unsigned: EditionFacts = {
        numbering: "none",
        signature: { kind: "unsigned" },
        certificate: { kind: "none" },
        confirmed: null,
      };
      await facts.saveFacts(artworkId, unsigned);
      expect(await facts.getFacts(artworkId)).toEqual(unsigned);
    });

    it("lets the database refuse facts that break a rule", async () => {
      const facts = createDrizzleEditionFactsRepository(db);
      const artworkId = await importArtwork({ eligible: true });
      await expect(
        facts.saveFacts(artworkId, {
          ...handSigned,
          numbering: "on_certificate",
          certificate: { kind: "none" },
        }),
      ).rejects.toThrow();
      expect(await facts.getFacts(artworkId)).toBeNull();
    });
  });
});
