import { shopArtist, shopArtwork, shopParty } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { assertArtistArchivable } from "@auction/shop-domain";
import { and, count, eq, isNotNull, isNull } from "drizzle-orm";
import { withAdminIdempotency } from "../application/admin/with-admin-idempotency.js";
import type { ArtistCatalogueWriter } from "../application/ports/artwork-catalogue-admin.js";
import type { ShopUnitOfWorkFactory } from "../application/ports/shop-unit-of-work.js";
import { ShopApiError, notFound } from "../errors/shop-api-error.js";
import { withCatalogueSlugConflict } from "./catalogue-unique-violation.js";
import { shopPhaseDbSession } from "./drizzle-shop-transaction-effects.js";

/** Staff create and archive artists. An artist is a party (for payouts and ownership) plus a profile. */
export function createDrizzleArtistCatalogueWriter(
  uow: ShopUnitOfWorkFactory,
): ArtistCatalogueWriter {
  return {
    createArtist: (input) =>
      uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "artist.create",
          idempotencyKey: input.idempotencyKey,
          actorSubjectId: input.actorSubjectId,
          requestPayload: input,
          run: async () => {
            const session = shopPhaseDbSession(tx);
            const [party] = await session
              .insert(shopParty)
              .values({ displayName: input.displayName })
              .returning({ id: shopParty.id });
            if (!party) {
              throw new ShopApiError(SHOP_API_ERROR_CODES.INTERNAL, "Failed to create artist", 500);
            }
            const [artist] = await withCatalogueSlugConflict(() =>
              session
                .insert(shopArtist)
                .values({ partyId: party.id, slug: input.slug, discipline: input.discipline })
                .returning({ id: shopArtist.id, slug: shopArtist.slug }),
            );
            if (!artist) {
              throw new ShopApiError(SHOP_API_ERROR_CODES.INTERNAL, "Failed to create artist", 500);
            }
            await tx.audit.append({
              actorSubjectId: input.actorSubjectId,
              capability: "catalogue.write",
              action: "create_artist",
              targetType: "shop_artist",
              targetId: artist.id,
              afterJson: {
                displayName: input.displayName,
                slug: input.slug,
                discipline: input.discipline,
              },
            });
            return { artistId: artist.id, slug: artist.slug };
          },
        }),
      ),

    setArtistArchived: (input) =>
      uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: input.archived ? "artist.archive" : "artist.restore",
          idempotencyKey: input.idempotencyKey,
          actorSubjectId: input.actorSubjectId,
          requestPayload: input,
          run: async () => {
            const session = shopPhaseDbSession(tx);
            const [artist] = await session
              .select({ id: shopArtist.id, archivedAt: shopArtist.archivedAt })
              .from(shopArtist)
              .where(eq(shopArtist.id, input.artistId))
              .for("update")
              .limit(1);
            if (!artist) throw notFound("Artist not found");
            if ((artist.archivedAt !== null) === input.archived) {
              return { artistId: artist.id, archived: input.archived, refreshesArt: false };
            }
            if (input.archived) {
              const [published] = await session
                .select({ total: count() })
                .from(shopArtwork)
                .where(
                  and(
                    eq(shopArtwork.artistId, artist.id),
                    isNotNull(shopArtwork.publishedAt),
                    isNull(shopArtwork.archivedAt),
                  ),
                );
              assertArtistArchivable({ publishedArtworkCount: Number(published?.total ?? 0) });
            }
            await session
              .update(shopArtist)
              .set({ archivedAt: input.archived ? new Date() : null })
              .where(eq(shopArtist.id, artist.id));
            await tx.audit.append({
              actorSubjectId: input.actorSubjectId,
              capability: "catalogue.write",
              action: input.archived ? "archive_artist" : "restore_artist",
              targetType: "shop_artist",
              targetId: artist.id,
              beforeJson: { archived: !input.archived },
              afterJson: { archived: input.archived },
            });
            // The artist's page and directory entry appear or disappear on lax.art.
            return { artistId: artist.id, archived: input.archived, refreshesArt: true };
          },
        }),
      ),
  };
}
