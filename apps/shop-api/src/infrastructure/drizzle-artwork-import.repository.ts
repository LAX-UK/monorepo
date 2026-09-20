import type { Database } from "@auction/db";
import { domainEvent, shopArtwork, shopEdition } from "@auction/db/schema";
import { assertValidEditionPlan, planEditionsForArtwork } from "@auction/shop-domain";
import { eq, sql } from "drizzle-orm";
import { assertArtworkImportIdentityUnchanged } from "../application/artwork-import-policy.js";
import type {
  ArtworkImportWriter,
  ImportArtworkCommand,
  ImportArtworkResult,
} from "../application/ports/artwork-import.writer.js";
import { ensureLaxShopParty } from "./ensure-lax-party.js";
import { updateShopArtist, upsertShopArtist } from "./upsert-shop-artist.js";

type Db = Database;

export function createDrizzleArtworkImportRepository(db: Db): ArtworkImportWriter {
  return {
    async importArtwork(command: ImportArtworkCommand): Promise<ImportArtworkResult> {
      return db.transaction(async (tx) => {
        // Serialize equal import keys so concurrent retries observe the first committed row.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${command.importKey}))`);
        const existing = await tx
          .select({
            id: shopArtwork.id,
            slug: shopArtwork.slug,
            artistId: shopArtwork.artistId,
            eligibleForEditionAllocation: shopArtwork.eligibleForEditionAllocation,
          })
          .from(shopArtwork)
          .where(eq(shopArtwork.importKey, command.importKey))
          .limit(1);
        const existingRow = existing[0];
        if (existingRow) {
          assertArtworkImportIdentityUnchanged(existingRow, command);
          await tx
            .update(shopArtwork)
            .set({
              title: command.title,
              description: command.description,
              primaryImageUrl: command.primaryImageUrl,
              dimensions: command.dimensions ?? null,
              yearCreated: command.yearCreated ?? null,
              saleState: command.saleState ?? "for_sale",
              printPricePence: command.printPricePence ?? null,
              updatedAt: new Date(),
            })
            .where(eq(shopArtwork.id, existingRow.id));
          await updateShopArtist(tx as Database, existingRow.artistId, {
            displayName: command.artistDisplayName,
            discipline: command.artistDiscipline ?? null,
            portraitImageUrl: command.artistPortraitUrl ?? null,
          });
          const editions = await tx
            .select({ id: shopEdition.id })
            .from(shopEdition)
            .where(eq(shopEdition.artworkId, existingRow.id));
          return {
            artworkId: existingRow.id,
            created: false,
            editionCount: editions.length,
          };
        }

        const artistId = await upsertShopArtist(tx as Database, {
          slug: command.artistSlug,
          displayName: command.artistDisplayName,
          discipline: command.artistDiscipline ?? null,
          portraitImageUrl: command.artistPortraitUrl ?? null,
        });

        const [artwork] = await tx
          .insert(shopArtwork)
          .values({
            slug: command.slug,
            title: command.title,
            description: command.description,
            primaryImageUrl: command.primaryImageUrl,
            dimensions: command.dimensions ?? null,
            yearCreated: command.yearCreated ?? null,
            saleState: command.saleState ?? "for_sale",
            artistId,
            eligibleForEditionAllocation: command.eligibleForEditionAllocation,
            printPricePence: command.printPricePence ?? null,
            importKey: command.importKey,
          })
          .returning({ id: shopArtwork.id });
        if (!artwork) throw new Error("Failed to create shop artwork");

        await tx.insert(domainEvent).values({
          aggregateType: "shop_artwork",
          aggregateId: artwork.id,
          eventType: "shop.artwork.created",
          payload: {
            importKey: command.importKey,
            slug: command.slug,
            eligibleForEditionAllocation: command.eligibleForEditionAllocation,
          },
          producer: "shop-api",
        });

        const plan = planEditionsForArtwork(command.eligibleForEditionAllocation);
        assertValidEditionPlan(plan);
        if (plan.length > 0) {
          const laxPartyId = await ensureLaxShopParty(tx as Database);
          await tx.insert(shopEdition).values(
            plan.map((row) => {
              const isLaxStock = row.allocation === "lax";
              return {
                artworkId: artwork.id,
                editionNumber: row.editionNumber,
                allocation: row.allocation,
                ownerPartyId: isLaxStock ? laxPartyId : null,
                status: isLaxStock ? ("available" as const) : ("allocated" as const),
              };
            }),
          );
          await tx.insert(domainEvent).values({
            aggregateType: "shop_artwork",
            aggregateId: artwork.id,
            eventType: "shop.editions.allocated",
            payload: {
              importKey: command.importKey,
              editionCount: plan.length,
            },
            producer: "shop-api",
          });
        }

        return {
          artworkId: artwork.id,
          created: true,
          editionCount: plan.length,
        };
      });
    },
  };
}
