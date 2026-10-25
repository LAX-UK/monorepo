import { randomUUID } from "node:crypto";
import type { Database } from "@auction/db";
import {
  shopArtist,
  shopArtwork,
  shopArtworkImage,
  shopEdition,
  shopMediaAsset,
} from "@auction/db/schema";
import {
  type AdminArtworkState,
  type AdminArtworkVisibilityAction,
  SHOP_API_ERROR_CODES,
} from "@auction/shop-contracts";
import {
  ARTWORK_PUBLISH_BLOCKER_MESSAGES,
  ShopDomainError,
  artworkCatalogueState,
  artworkPublishBlockers,
  assertEditionPrice,
  assertLivePriceKept,
  assertSourceOriginal,
} from "@auction/shop-domain";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { withAdminIdempotency } from "../application/admin/with-admin-idempotency.js";
import type {
  ArtworkCatalogueWriter,
  ArtworkEditableFields,
} from "../application/ports/artwork-catalogue-admin.js";
import type { ShopTransactionEffects } from "../application/ports/shop-unit-of-work.js";
import type { ShopUnitOfWorkFactory } from "../application/ports/shop-unit-of-work.js";
import { ShopApiError, notFound } from "../errors/shop-api-error.js";
import { StaleVersionError } from "../errors/stale-version-error.js";
import { withCatalogueSlugConflict } from "./catalogue-unique-violation.js";
import { shopPhaseDbSession } from "./drizzle-shop-transaction-effects.js";
import { insertPlannedEditions } from "./insert-planned-editions.js";

type ResolveMediaUrl = (value: string | null | undefined) => string | null;
type ArtworkRow = typeof shopArtwork.$inferSelect;

const CAPABILITY = "catalogue.write";
const PRICE_CAPABILITY = "artwork_price.write";

function priceForbidden(): ShopApiError {
  return new ShopApiError(
    SHOP_API_ERROR_CODES.FORBIDDEN,
    "Setting an edition price needs price access",
    403,
  );
}

async function lockArtwork(tx: ShopTransactionEffects, artworkId: string): Promise<ArtworkRow> {
  const [artwork] = await shopPhaseDbSession(tx)
    .select()
    .from(shopArtwork)
    .where(eq(shopArtwork.id, artworkId))
    .for("update")
    .limit(1);
  if (!artwork) throw notFound("Artwork not found");
  return artwork;
}

async function readArtist(tx: ShopTransactionEffects, artistId: string) {
  const [artist] = await shopPhaseDbSession(tx)
    .select({ id: shopArtist.id, archivedAt: shopArtist.archivedAt })
    .from(shopArtist)
    .where(eq(shopArtist.id, artistId))
    .limit(1);
  if (!artist) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "Choose an existing artist", 400);
  }
  return artist;
}

/** Refuses image keys that were never uploaded and confirmed as artwork images. */
async function assertUploadedImages(
  tx: ShopTransactionEffects,
  mediaKeys: readonly string[],
): Promise<void> {
  if (mediaKeys.length === 0) return;
  const unique = [...new Set(mediaKeys)];
  const found = await shopPhaseDbSession(tx)
    .select({ key: shopMediaAsset.key })
    .from(shopMediaAsset)
    .where(
      and(
        inArray(shopMediaAsset.key, unique),
        eq(shopMediaAsset.kind, "artwork_image"),
        eq(shopMediaAsset.status, "active"),
      ),
    );
  if (found.length !== unique.length) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.VALIDATION,
      "An image upload did not finish; upload it again",
      400,
    );
  }
}

/**
 * Checks the original an edition is linked to. Throws 400 for an id that is not an artwork, and a
 * domain error (409) when the link breaks a catalogue rule.
 */
async function assertLinkableOriginal(
  tx: ShopTransactionEffects,
  artwork: { artworkId: string | null; eligibleForEditionAllocation: boolean },
  sourceOriginalArtworkId: string | null,
): Promise<void> {
  if (sourceOriginalArtworkId === null) return;
  const [source] = await shopPhaseDbSession(tx)
    .select({
      artworkId: shopArtwork.id,
      eligibleForEditionAllocation: shopArtwork.eligibleForEditionAllocation,
    })
    .from(shopArtwork)
    .where(eq(shopArtwork.id, sourceOriginalArtworkId))
    .limit(1);
  if (!source) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "Choose an existing original", 400);
  }
  assertSourceOriginal({ ...artwork, source });
}

async function imageKeysOf(tx: ShopTransactionEffects, artworkId: string): Promise<string[]> {
  const rows = await shopPhaseDbSession(tx)
    .select({ mediaKey: shopArtworkImage.mediaKey })
    .from(shopArtworkImage)
    .where(eq(shopArtworkImage.artworkId, artworkId))
    .orderBy(asc(shopArtworkImage.position));
  return rows.map((row) => row.mediaKey);
}

async function replaceImages(
  tx: ShopTransactionEffects,
  artworkId: string,
  images: ArtworkEditableFields["images"],
): Promise<void> {
  const session = shopPhaseDbSession(tx);
  await session.delete(shopArtworkImage).where(eq(shopArtworkImage.artworkId, artworkId));
  const unique = [...new Map(images.map((image) => [image.mediaKey, image])).values()];
  if (unique.length === 0) return;
  await session.insert(shopArtworkImage).values(
    unique.map((image, position) => ({
      artworkId,
      mediaKey: image.mediaKey,
      position,
      alt: image.alt,
    })),
  );
}

async function editionCounts(tx: ShopTransactionEffects, artworkId: string) {
  const [row] = await shopPhaseDbSession(tx)
    .select({
      total: count(),
      sold: sql<number>`count(*) filter (where ${shopEdition.listingStatus} = 'sold')`,
    })
    .from(shopEdition)
    .where(eq(shopEdition.artworkId, artworkId));
  return { total: Number(row?.total ?? 0), sold: Number(row?.sold ?? 0) };
}

async function stateOf(
  tx: ShopTransactionEffects,
  artwork: ArtworkRow,
): Promise<AdminArtworkState> {
  const counts = await editionCounts(tx, artwork.id);
  return artworkCatalogueState({
    publishedAt: artwork.publishedAt,
    archivedAt: artwork.archivedAt,
    saleState: artwork.saleState,
    eligibleForEditionAllocation: artwork.eligibleForEditionAllocation,
    editionCount: counts.total,
    soldEditionCount: counts.sold,
  });
}

/** The fields an audit entry records, so before and after read the same way. */
function auditFields(artwork: Pick<ArtworkRow, keyof AuditedArtwork>, imageKeys: string[]) {
  return {
    title: artwork.title,
    artistId: artwork.artistId,
    yearCreated: artwork.yearCreated,
    medium: artwork.medium,
    dimensions: artwork.dimensions,
    description: artwork.description,
    printPricePence: artwork.printPricePence,
    saleState: artwork.saleState,
    salesChannel: artwork.salesChannel,
    sourceOriginalArtworkId: artwork.sourceOriginalArtworkId,
    seoTitle: artwork.seoTitle,
    seoDescription: artwork.seoDescription,
    images: imageKeys,
  };
}
type AuditedArtwork = Omit<ArtworkEditableFields, "images">;

/** Only what changed, so the audit log reads as a diff. */
function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { beforeJson: Record<string, unknown>; afterJson: Record<string, unknown> } {
  const beforeJson: Record<string, unknown> = {};
  const afterJson: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      beforeJson[key] = before[key];
      afterJson[key] = after[key];
    }
  }
  return { beforeJson, afterJson };
}

function onStorefront(artwork: Pick<ArtworkRow, "publishedAt" | "archivedAt">): boolean {
  return artwork.publishedAt !== null && artwork.archivedAt === null;
}

/**
 * Whether lax.art shows something different after this change: the artwork is (or was) on the
 * lax.art channel, or is an edition linked to an original there (lax.art lists it on the
 * original's page), and was or is now visible. Draft-only edits change nothing it serves.
 */
function changesArtStorefront(before: ArtworkRow, after: ArtworkRow): boolean {
  const onArt =
    before.salesChannel === "art" ||
    after.salesChannel === "art" ||
    before.sourceOriginalArtworkId !== null ||
    after.sourceOriginalArtworkId !== null;
  return onArt && (onStorefront(before) || onStorefront(after));
}

type VisibilityOutcome =
  | { outcome: "changed" | "unchanged"; artwork: ArtworkRow }
  | { outcome: "refused"; message: string };

/**
 * Publish, unpublish, archive or restore one locked artwork. Refusals are returned, not thrown,
 * so a bulk change can report them per artwork and carry on with the rest.
 */
async function applyVisibility(
  tx: ShopTransactionEffects,
  artwork: ArtworkRow,
  action: AdminArtworkVisibilityAction,
  actorSubjectId: string,
): Promise<VisibilityOutcome> {
  const now = new Date();
  let patch: Partial<Pick<ArtworkRow, "publishedAt" | "archivedAt">> | null = null;
  switch (action) {
    case "publish": {
      if (artwork.archivedAt === null && artwork.publishedAt !== null) break;
      const [artist, imageKeys] = await Promise.all([
        readArtist(tx, artwork.artistId),
        imageKeysOf(tx, artwork.id),
      ]);
      const [blocker] = artworkPublishBlockers({
        archived: artwork.archivedAt !== null,
        artistArchived: artist.archivedAt !== null,
        hasImage: imageKeys.length > 0 || artwork.primaryImageUrl !== null,
        eligibleForEditionAllocation: artwork.eligibleForEditionAllocation,
        saleState: artwork.saleState,
        printPricePence: artwork.printPricePence,
      });
      if (blocker)
        return { outcome: "refused", message: ARTWORK_PUBLISH_BLOCKER_MESSAGES[blocker] };
      patch = { publishedAt: now };
      break;
    }
    case "unpublish":
      if (artwork.publishedAt !== null && artwork.archivedAt === null)
        patch = { publishedAt: null };
      break;
    case "archive":
      if (artwork.archivedAt === null) patch = { archivedAt: now, publishedAt: null };
      break;
    case "restore":
      // Back to a draft: staff check it again before it returns to the storefront.
      if (artwork.archivedAt !== null) patch = { archivedAt: null };
      break;
  }
  if (!patch) return { outcome: "unchanged", artwork };
  const [after] = await shopPhaseDbSession(tx)
    .update(shopArtwork)
    .set({ ...patch, updatedAt: now })
    .where(eq(shopArtwork.id, artwork.id))
    .returning();
  if (!after) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.INTERNAL, "Failed to save artwork", 500);
  }
  await tx.audit.append({
    actorSubjectId,
    capability: CAPABILITY,
    action: `${action}_artwork`,
    targetType: "shop_artwork",
    targetId: artwork.id,
    beforeJson: {
      published: artwork.publishedAt !== null,
      archived: artwork.archivedAt !== null,
    },
    afterJson: { published: after.publishedAt !== null, archived: after.archivedAt !== null },
  });
  return { outcome: "changed", artwork: after };
}

export function createDrizzleArtworkCatalogueWriter(
  uow: ShopUnitOfWorkFactory,
  options: { resolveMediaUrl: ResolveMediaUrl },
): ArtworkCatalogueWriter {
  const { resolveMediaUrl } = options;
  return {
    createArtwork: (input) =>
      uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "artwork.create",
          idempotencyKey: input.idempotencyKey,
          actorSubjectId: input.actorSubjectId,
          requestPayload: input,
          run: async () => {
            if (input.printPricePence !== null && !input.canSetPrice) throw priceForbidden();
            assertEditionPrice({
              pricePence: input.printPricePence,
              eligibleForEditionAllocation: input.eligibleForEditionAllocation,
            });
            const artist = await readArtist(tx, input.artistId);
            if (artist.archivedAt) {
              throw new ShopDomainError("The artist is archived; restore the artist first");
            }
            await assertUploadedImages(
              tx,
              input.images.map((image) => image.mediaKey),
            );
            const sourceOriginalArtworkId = input.sourceOriginalArtworkId ?? null;
            await assertLinkableOriginal(
              tx,
              { artworkId: null, eligibleForEditionAllocation: input.eligibleForEditionAllocation },
              sourceOriginalArtworkId,
            );
            const session = shopPhaseDbSession(tx);
            const importKey = `staff:${randomUUID()}`;
            const [artwork] = await withCatalogueSlugConflict(() =>
              session
                .insert(shopArtwork)
                .values({
                  slug: input.slug,
                  title: input.title,
                  artistId: input.artistId,
                  yearCreated: input.yearCreated,
                  medium: input.medium,
                  dimensions: input.dimensions,
                  description: input.description,
                  eligibleForEditionAllocation: input.eligibleForEditionAllocation,
                  printPricePence: input.printPricePence,
                  saleState: input.saleState,
                  salesChannel: input.salesChannel,
                  sourceOriginalArtworkId,
                  seoTitle: input.seoTitle,
                  seoDescription: input.seoDescription,
                  primaryImageUrl: resolveMediaUrl(input.images[0]?.mediaKey),
                  importKey,
                  // Staff-created artworks start as drafts; publishing is a separate step.
                  publishedAt: null,
                })
                .returning(),
            );
            if (!artwork) {
              throw new ShopApiError(
                SHOP_API_ERROR_CODES.INTERNAL,
                "Failed to create artwork",
                500,
              );
            }
            await replaceImages(tx, artwork.id, input.images);
            await tx.events.append({
              aggregateType: "shop_artwork",
              aggregateId: artwork.id,
              eventType: "shop.artwork.created",
              payload: {
                schemaVersion: 1,
                importKey,
                slug: artwork.slug,
                eligibleForEditionAllocation: artwork.eligibleForEditionAllocation,
              },
            });
            const editionCount = await insertPlannedEditions(session as Database, {
              artworkId: artwork.id,
              artistId: artwork.artistId,
              eligibleForEditionAllocation: artwork.eligibleForEditionAllocation,
            });
            if (editionCount > 0) {
              await tx.events.append({
                aggregateType: "shop_artwork",
                aggregateId: artwork.id,
                eventType: "shop.editions.allocated",
                payload: { schemaVersion: 1, importKey, editionCount },
              });
            }
            await tx.audit.append({
              actorSubjectId: input.actorSubjectId,
              capability: CAPABILITY,
              action: "create_artwork",
              targetType: "shop_artwork",
              targetId: artwork.id,
              afterJson: {
                slug: artwork.slug,
                eligibleForEditionAllocation: artwork.eligibleForEditionAllocation,
                editionCount,
                ...auditFields(
                  artwork,
                  input.images.map((image) => image.mediaKey),
                ),
              },
            });
            return {
              artworkId: artwork.id,
              slug: artwork.slug,
              version: artwork.updatedAt.toISOString(),
              // A new artwork is a draft: nothing on lax.art changes until it is published.
              refreshesArt: false,
            };
          },
        }),
      ),

    updateArtwork: (input) =>
      uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "artwork.update",
          idempotencyKey: input.idempotencyKey,
          actorSubjectId: input.actorSubjectId,
          requestPayload: input,
          run: async () => {
            const before = await lockArtwork(tx, input.artworkId);
            // Versions travel as millisecond ISO strings; the column holds microseconds.
            if (before.updatedAt.getTime() !== new Date(input.expectedVersion).getTime()) {
              throw new StaleVersionError("This artwork", before.updatedAt.toISOString());
            }
            const priceChanged = input.printPricePence !== before.printPricePence;
            if (priceChanged && !input.canSetPrice) throw priceForbidden();
            assertEditionPrice({
              pricePence: input.printPricePence,
              eligibleForEditionAllocation: before.eligibleForEditionAllocation,
            });
            assertLivePriceKept({
              published: before.publishedAt !== null && before.archivedAt === null,
              eligibleForEditionAllocation: before.eligibleForEditionAllocation,
              saleState: input.saleState,
              printPricePence: input.printPricePence,
            });
            if (input.artistId !== before.artistId) {
              const artist = await readArtist(tx, input.artistId);
              if (artist.archivedAt) {
                throw new ShopDomainError("The artist is archived; restore the artist first");
              }
            }
            const sourceOriginalArtworkId =
              input.sourceOriginalArtworkId === undefined
                ? before.sourceOriginalArtworkId
                : input.sourceOriginalArtworkId;
            if (sourceOriginalArtworkId !== before.sourceOriginalArtworkId) {
              await assertLinkableOriginal(
                tx,
                {
                  artworkId: before.id,
                  eligibleForEditionAllocation: before.eligibleForEditionAllocation,
                },
                sourceOriginalArtworkId,
              );
            }
            const beforeKeys = await imageKeysOf(tx, input.artworkId);
            const nextKeys = input.images.map((image) => image.mediaKey);
            await assertUploadedImages(
              tx,
              nextKeys.filter((key) => !beforeKeys.includes(key)),
            );
            // An image URL from an import stays until images are uploaded here.
            const primaryImageUrl =
              nextKeys.length > 0
                ? resolveMediaUrl(nextKeys[0])
                : beforeKeys.length > 0
                  ? null
                  : before.primaryImageUrl;
            const [after] = await shopPhaseDbSession(tx)
              .update(shopArtwork)
              .set({
                title: input.title,
                artistId: input.artistId,
                yearCreated: input.yearCreated,
                medium: input.medium,
                dimensions: input.dimensions,
                description: input.description,
                printPricePence: input.printPricePence,
                saleState: input.saleState,
                salesChannel: input.salesChannel,
                sourceOriginalArtworkId,
                seoTitle: input.seoTitle,
                seoDescription: input.seoDescription,
                primaryImageUrl,
                updatedAt: new Date(),
              })
              .where(eq(shopArtwork.id, input.artworkId))
              .returning();
            if (!after) {
              throw new ShopApiError(SHOP_API_ERROR_CODES.INTERNAL, "Failed to save artwork", 500);
            }
            await replaceImages(tx, input.artworkId, input.images);
            const diff = changedFields(
              auditFields(before, beforeKeys),
              auditFields(after, [...new Set(nextKeys)]),
            );
            await tx.audit.append({
              actorSubjectId: input.actorSubjectId,
              capability: priceChanged ? PRICE_CAPABILITY : CAPABILITY,
              action: "update_artwork",
              targetType: "shop_artwork",
              targetId: input.artworkId,
              ...diff,
            });
            return {
              version: after.updatedAt.toISOString(),
              refreshesArt: changesArtStorefront(before, after),
            };
          },
        }),
      ),

    setPrice: (input) =>
      uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "artwork.set_price",
          idempotencyKey: input.idempotencyKey,
          actorSubjectId: input.actorSubjectId,
          requestPayload: input,
          run: async () => {
            const before = await lockArtwork(tx, input.artworkId);
            if (before.updatedAt.getTime() !== new Date(input.expectedVersion).getTime()) {
              throw new StaleVersionError("This artwork", before.updatedAt.toISOString());
            }
            assertEditionPrice({
              pricePence: input.printPricePence,
              eligibleForEditionAllocation: before.eligibleForEditionAllocation,
            });
            assertLivePriceKept({
              published: onStorefront(before),
              eligibleForEditionAllocation: before.eligibleForEditionAllocation,
              saleState: before.saleState,
              printPricePence: input.printPricePence,
            });
            if (input.printPricePence === before.printPricePence) {
              return { version: before.updatedAt.toISOString(), refreshesArt: false };
            }
            const [after] = await shopPhaseDbSession(tx)
              .update(shopArtwork)
              .set({ printPricePence: input.printPricePence, updatedAt: new Date() })
              .where(eq(shopArtwork.id, input.artworkId))
              .returning();
            if (!after) {
              throw new ShopApiError(SHOP_API_ERROR_CODES.INTERNAL, "Failed to save artwork", 500);
            }
            await tx.audit.append({
              actorSubjectId: input.actorSubjectId,
              capability: PRICE_CAPABILITY,
              action: "set_artwork_price",
              targetType: "shop_artwork",
              targetId: input.artworkId,
              beforeJson: { printPricePence: before.printPricePence },
              afterJson: { printPricePence: after.printPricePence },
            });
            return {
              version: after.updatedAt.toISOString(),
              refreshesArt: changesArtStorefront(before, after),
            };
          },
        }),
      ),

    setVisibility: (input) =>
      uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: `artwork.${input.action}`,
          idempotencyKey: input.idempotencyKey,
          actorSubjectId: input.actorSubjectId,
          requestPayload: input,
          run: async () => {
            const artwork = await lockArtwork(tx, input.artworkId);
            const result = await applyVisibility(tx, artwork, input.action, input.actorSubjectId);
            if (result.outcome === "refused") throw new ShopDomainError(result.message);
            return {
              version: result.artwork.updatedAt.toISOString(),
              state: await stateOf(tx, result.artwork),
              refreshesArt:
                result.outcome === "changed" && changesArtStorefront(artwork, result.artwork),
            };
          },
        }),
      ),

    applyBulkVisibility: (input) =>
      uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: `artwork.bulk_${input.action}`,
          idempotencyKey: input.idempotencyKey,
          actorSubjectId: input.actorSubjectId,
          requestPayload: input,
          run: async () => {
            // Lock in id order so two overlapping bulk changes cannot deadlock.
            const ids = [...new Set(input.artworkIds)].sort();
            const rows = await shopPhaseDbSession(tx)
              .select()
              .from(shopArtwork)
              .where(inArray(shopArtwork.id, ids))
              .orderBy(asc(shopArtwork.id))
              .for("update");
            const byId = new Map(rows.map((row) => [row.id, row]));
            const results = [];
            let refreshesArt = false;
            for (const artworkId of input.artworkIds) {
              const artwork = byId.get(artworkId);
              if (!artwork) {
                results.push({ artworkId, outcome: "not_found" as const });
                continue;
              }
              const result = await applyVisibility(tx, artwork, input.action, input.actorSubjectId);
              if (result.outcome === "changed" && changesArtStorefront(artwork, result.artwork)) {
                refreshesArt = true;
              }
              results.push(
                result.outcome === "refused"
                  ? { artworkId, outcome: "refused" as const, message: result.message }
                  : { artworkId, outcome: result.outcome },
              );
            }
            return { results, refreshesArt };
          },
        }),
      ),
  };
}
