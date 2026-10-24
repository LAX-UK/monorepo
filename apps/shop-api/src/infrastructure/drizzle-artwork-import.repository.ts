import type { Database } from "@auction/db";
import { shopArtwork, shopArtworkImage, shopEdition } from "@auction/db/schema";
import { eq, sql } from "drizzle-orm";
import { assertArtworkImportIdentityUnchanged } from "../application/artwork-import-policy.js";
import type {
  ArtworkImportWriter,
  ImportArtworkCommand,
  ImportArtworkResult,
} from "../application/ports/artwork-import.writer.js";
import { insertPlannedEditions } from "./insert-planned-editions.js";
import type { ShopDomainEventPublisherMode } from "./shop-domain-event-publisher.js";
import { createShopDomainEventPublisher } from "./shop-domain-event-publisher.js";
import { updateShopArtist, upsertShopArtist } from "./upsert-shop-artist.js";

type Db = Database;

function numericColumn(value: number | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : value.toFixed(2);
}

/** Optional command fields: only those provided are written. */
function optionalArtworkColumns(command: ImportArtworkCommand) {
  const columns = {
    seoTitle: command.seoTitle,
    seoDescription: command.seoDescription,
    salesChannel: command.salesChannel,
    objectType: command.objectType,
    rarity: command.rarity,
    heightCm: numericColumn(command.heightCm),
    widthCm: numericColumn(command.widthCm),
    depthCm: numericColumn(command.depthCm),
    hasCertificate: command.hasCertificate,
  };
  return Object.fromEntries(
    Object.entries(columns).filter(([, value]) => value !== undefined),
  ) as Partial<typeof shopArtwork.$inferInsert>;
}

async function replaceArtworkImages(
  tx: Db,
  artworkId: string,
  images: ImportArtworkCommand["images"],
): Promise<void> {
  if (images === undefined) return;
  await tx.delete(shopArtworkImage).where(eq(shopArtworkImage.artworkId, artworkId));
  const unique = [...new Map(images.map((image) => [image.mediaKey, image])).values()];
  if (unique.length === 0) return;
  await tx.insert(shopArtworkImage).values(
    unique.map((image, position) => ({
      artworkId,
      mediaKey: image.mediaKey,
      position,
      alt: image.alt,
    })),
  );
}

export function createDrizzleArtworkImportRepository(
  db: Db,
  eventPublishMode: ShopDomainEventPublisherMode = "observe",
): ArtworkImportWriter {
  const events = createShopDomainEventPublisher(eventPublishMode);
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
              ...(command.medium !== undefined ? { medium: command.medium } : {}),
              yearCreated: command.yearCreated ?? null,
              saleState: command.saleState ?? "for_sale",
              printPricePence: command.printPricePence ?? null,
              ...optionalArtworkColumns(command),
              updatedAt: new Date(),
            })
            .where(eq(shopArtwork.id, existingRow.id));
          await replaceArtworkImages(tx as Database, existingRow.id, command.images);
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
            medium: command.medium ?? null,
            yearCreated: command.yearCreated ?? null,
            saleState: command.saleState ?? "for_sale",
            artistId,
            eligibleForEditionAllocation: command.eligibleForEditionAllocation,
            printPricePence: command.printPricePence ?? null,
            importKey: command.importKey,
            publishedAt: command.publishOnCreate ? new Date() : null,
            ...optionalArtworkColumns(command),
          })
          .returning({ id: shopArtwork.id });
        if (!artwork) throw new Error("Failed to create shop artwork");
        await replaceArtworkImages(tx as Database, artwork.id, command.images);

        await events.insertInTransaction(tx as Database, {
          aggregateType: "shop_artwork",
          aggregateId: artwork.id,
          eventType: "shop.artwork.created",
          payload: {
            schemaVersion: 1,
            importKey: command.importKey,
            slug: command.slug,
            eligibleForEditionAllocation: command.eligibleForEditionAllocation,
          },
          producer: "shop-api",
        });

        const editionCount = await insertPlannedEditions(tx as Database, {
          artworkId: artwork.id,
          artistId,
          eligibleForEditionAllocation: command.eligibleForEditionAllocation,
        });
        if (editionCount > 0) {
          await events.insertInTransaction(tx as Database, {
            aggregateType: "shop_artwork",
            aggregateId: artwork.id,
            eventType: "shop.editions.allocated",
            payload: {
              schemaVersion: 1,
              importKey: command.importKey,
              editionCount,
            },
            producer: "shop-api",
          });
        }

        return {
          artworkId: artwork.id,
          created: true,
          editionCount,
        };
      });
    },
  };
}
