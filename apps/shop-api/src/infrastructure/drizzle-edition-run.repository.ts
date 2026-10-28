import type { Database } from "@auction/db";
import {
  shopArtist,
  shopArtwork,
  shopArtworkImage,
  shopEdition,
  shopEditionStockBatch,
} from "@auction/db/schema";
import {
  ShopDomainError,
  assertLinkableToMainRun,
  assertValidRunSpec,
  planOpenEditionBatch,
} from "@auction/shop-domain";
import { asc, eq, sql } from "drizzle-orm";
import type {
  AddStockBatchCommand,
  EditionRunConfig,
  EditionRunRepository,
  EditionStockBatch,
  StoredEditionRun,
} from "../application/ports/edition-run.repository.js";
import { notFound } from "../errors/shop-api-error.js";
import { proofsKeptFromColumns, runFromColumns, runToColumns } from "./edition-run-columns.js";
import { ensureLaxShopParty } from "./ensure-lax-party.js";

type Executor = Pick<Database, "select" | "update" | "insert">;

async function loadArtwork(db: Executor, artworkId: string) {
  const [row] = await db.select().from(shopArtwork).where(eq(shopArtwork.id, artworkId)).limit(1);
  return row ?? null;
}

async function imageKeyOf(
  db: Executor,
  artwork: { id: string; primaryImageUrl: string | null },
): Promise<string | null> {
  const [first] = await db
    .select({ mediaKey: shopArtworkImage.mediaKey })
    .from(shopArtworkImage)
    .where(eq(shopArtworkImage.artworkId, artwork.id))
    .orderBy(asc(shopArtworkImage.position))
    .limit(1);
  return first?.mediaKey ?? artwork.primaryImageUrl;
}

async function readRun(db: Executor, artworkId: string): Promise<StoredEditionRun | null> {
  const row = await loadArtwork(db, artworkId);
  if (!row) return null;
  const main = row.mainRunArtworkId ? await loadArtwork(db, row.mainRunArtworkId) : null;
  return runFromColumns(row, main ? proofsKeptFromColumns(main) : null);
}

function toBatch(row: typeof shopEditionStockBatch.$inferSelect): EditionStockBatch {
  return {
    id: row.id,
    artworkId: row.artworkId,
    firstStockRef: row.firstStockRef,
    quantity: row.quantity,
    artistCount: row.artistCount,
    laxCount: row.laxCount,
    custodyStatus: row.custodyStatus === "stored" ? "stored" : "unprinted",
    storageLocation: row.storageLocation,
    addedBySubjectId: row.addedBySubjectId,
    createdAt: row.createdAt,
  };
}

export function createDrizzleEditionRunRepository(db: Database): EditionRunRepository {
  return {
    getRun: (artworkId) => readRun(db, artworkId),

    async saveRun(artworkId: string, config: EditionRunConfig): Promise<void> {
      await db.transaction(async (tx) => {
        const executor = tx as unknown as Executor;
        const artwork = await loadArtwork(executor, artworkId);
        if (!artwork) throw notFound("Artwork not found");
        const { spec } = config;
        if (spec.type === "proof" || spec.type === "companion") {
          const main = await loadArtwork(executor, spec.mainRunId);
          if (!main?.runRole) throw new ShopDomainError("The main run was not found");
          assertLinkableToMainRun(
            { artistId: artwork.artistId, imageKey: await imageKeyOf(executor, artwork) },
            {
              role: main.runRole,
              artistId: main.artistId,
              imageKey: await imageKeyOf(executor, main),
            },
          );
          if (spec.type === "proof") {
            // The main run's own count is the truth, whatever the caller read earlier.
            assertValidRunSpec({
              ...spec,
              proofsKeptOnMain: proofsKeptFromColumns(main)[spec.proofType],
            });
          }
        }
        const columns = runToColumns(config);
        if (
          columns.allocBuyer &&
          columns.runTemplate === "custom" &&
          !artwork.sourceOriginalArtworkId
        ) {
          throw new ShopDomainError(
            "Buyer prints need an original on lax.art. Link the original or set buyers to 0",
          );
        }
        await tx.update(shopArtwork).set(columns).where(eq(shopArtwork.id, artworkId));
      });
    },

    async listStockBatches(artworkId: string): Promise<EditionStockBatch[]> {
      const rows = await db
        .select()
        .from(shopEditionStockBatch)
        .where(eq(shopEditionStockBatch.artworkId, artworkId))
        .orderBy(asc(shopEditionStockBatch.firstStockRef));
      return rows.map(toBatch);
    },

    async addStockBatch(command: AddStockBatchCommand): Promise<EditionStockBatch> {
      return db.transaction(async (tx) => {
        const [artwork] = await tx
          .select()
          .from(shopArtwork)
          .where(eq(shopArtwork.id, command.artworkId))
          .for("update")
          .limit(1);
        if (!artwork) throw notFound("Artwork not found");
        if (artwork.runKind !== "open") {
          throw new ShopDomainError("Prints can only be added to an open edition");
        }
        const [{ lastStockRef } = { lastStockRef: 0 }] = await tx
          .select({ lastStockRef: sql<number>`coalesce(max(${shopEdition.stockRef}), 0)::int` })
          .from(shopEdition)
          .where(eq(shopEdition.artworkId, artwork.id));
        const plan = planOpenEditionBatch({
          firstStockRef: lastStockRef + 1,
          artistCount: command.artistCount,
          laxCount: command.laxCount,
        });
        const laxPartyId = await ensureLaxShopParty(tx as unknown as Database);
        const [artist] = await tx
          .select({ partyId: shopArtist.partyId })
          .from(shopArtist)
          .where(eq(shopArtist.id, artwork.artistId))
          .limit(1);
        if (command.artistCount > 0 && !artist?.partyId) {
          throw new ShopDomainError("The artist has no party to own prints yet");
        }
        const storageLocation = command.storageLocation?.trim() || null;
        await tx.insert(shopEdition).values(
          plan.map((row) => ({
            artworkId: artwork.id,
            editionNumber: row.editionNumber,
            stockRef: row.stockRef,
            allocation: row.allocation,
            ownerPartyId: row.allocation === "lax" ? laxPartyId : (artist?.partyId ?? null),
            listingStatus: "not_authorised" as const,
            custodyStatus: command.custodyStatus,
            storageLocation: command.custodyStatus === "stored" ? storageLocation : null,
          })),
        );
        const [batch] = await tx
          .insert(shopEditionStockBatch)
          .values({
            artworkId: artwork.id,
            firstStockRef: lastStockRef + 1,
            quantity: plan.length,
            artistCount: command.artistCount,
            laxCount: command.laxCount,
            custodyStatus: command.custodyStatus,
            storageLocation: command.custodyStatus === "stored" ? storageLocation : null,
            addedBySubjectId: command.addedBySubjectId,
          })
          .returning();
        if (!batch) throw new Error("Failed to record the stock batch");
        return toBatch(batch);
      });
    },
  };
}
