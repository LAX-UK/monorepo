import { shopArtist } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { eq } from "drizzle-orm";
import { operatorContextAuditFields } from "../../../application/admin/operator-context.js";
import { withAdminIdempotency } from "../../../application/admin/with-admin-idempotency.js";
import type { ShopUnitOfWorkFactory } from "../../../application/ports/shop-unit-of-work.js";
import { ShopApiError, notFound } from "../../../errors/shop-api-error.js";
import { isPgUniqueViolation } from "../../../lib/pg-errors.js";
import { shopPhaseDbSession } from "../../drizzle-shop-transaction-effects.js";
import { resolveActiveProfileByEmail } from "../../resolve-shop-profile-by-email.js";

export type LinkArtistIdentityCommand = {
  artistId: string;
  email: string;
  actorSubjectId: string;
  idempotencyKey: string;
  operatorContext?: import("../../../application/admin/operator-context.js").ShopOperatorContext;
};

export type UnlinkArtistIdentityCommand = {
  artistId: string;
  actorSubjectId: string;
  idempotencyKey: string;
  operatorContext?: import("../../../application/admin/operator-context.js").ShopOperatorContext;
};

async function lockArtistRow(
  tx: ReturnType<typeof shopPhaseDbSession>,
  artistId: string,
): Promise<{ id: string; identitySubjectId: string | null }> {
  const [artist] = await tx
    .select({
      id: shopArtist.id,
      identitySubjectId: shopArtist.identitySubjectId,
    })
    .from(shopArtist)
    .where(eq(shopArtist.id, artistId))
    .for("update")
    .limit(1);
  if (!artist) {
    throw notFound("Artist");
  }
  return artist;
}

export function createLinkArtistIdentityHandler(deps: {
  uow: ShopUnitOfWorkFactory;
}): (command: LinkArtistIdentityCommand) => Promise<{
  artistId: string;
  identitySubjectId: string;
}> {
  return async (command) =>
    deps.uow.run(async (tx) =>
      withAdminIdempotency({
        tx,
        commandType: "artist.link_identity",
        idempotencyKey: command.idempotencyKey,
        actorSubjectId: command.actorSubjectId,
        requestPayload: command,
        run: async () => {
          const db = shopPhaseDbSession(tx);
          const profile = await resolveActiveProfileByEmail(db, command.email);
          const before = await lockArtistRow(db, command.artistId);

          if (before.identitySubjectId === profile.identitySubjectId) {
            return {
              artistId: command.artistId,
              identitySubjectId: profile.identitySubjectId,
            };
          }
          if (
            before.identitySubjectId != null &&
            before.identitySubjectId !== profile.identitySubjectId
          ) {
            throw new ShopApiError(
              SHOP_API_ERROR_CODES.CONFLICT,
              "Artist is already linked to a different login",
              409,
            );
          }

          const [otherArtist] = await db
            .select({ id: shopArtist.id })
            .from(shopArtist)
            .where(eq(shopArtist.identitySubjectId, profile.identitySubjectId))
            .limit(1);
          if (otherArtist && otherArtist.id !== command.artistId) {
            throw new ShopApiError(
              SHOP_API_ERROR_CODES.CONFLICT,
              "Login is already linked to another artist",
              409,
            );
          }

          try {
            await db
              .update(shopArtist)
              .set({ identitySubjectId: profile.identitySubjectId })
              .where(eq(shopArtist.id, command.artistId));
          } catch (error) {
            if (isPgUniqueViolation(error)) {
              throw new ShopApiError(
                SHOP_API_ERROR_CODES.CONFLICT,
                "Login is already linked to another artist",
                409,
              );
            }
            throw error;
          }

          await tx.audit.append({
            actorSubjectId: command.actorSubjectId,
            capability: "catalogue.write",
            action: "link_artist_identity",
            targetType: "shop_artist",
            targetId: command.artistId,
            beforeJson: { identitySubjectId: before.identitySubjectId },
            afterJson: {
              identitySubjectId: profile.identitySubjectId,
              email: command.email.trim().toLowerCase(),
              ...operatorContextAuditFields(command.operatorContext),
            },
          });

          return {
            artistId: command.artistId,
            identitySubjectId: profile.identitySubjectId,
          };
        },
      }),
    );
}

export function createUnlinkArtistIdentityHandler(deps: {
  uow: ShopUnitOfWorkFactory;
}): (command: UnlinkArtistIdentityCommand) => Promise<{ artistId: string }> {
  return async (command) =>
    deps.uow.run(async (tx) =>
      withAdminIdempotency({
        tx,
        commandType: "artist.unlink_identity",
        idempotencyKey: command.idempotencyKey,
        actorSubjectId: command.actorSubjectId,
        requestPayload: command,
        run: async () => {
          const db = shopPhaseDbSession(tx);
          const before = await lockArtistRow(db, command.artistId);

          if (before.identitySubjectId == null) {
            return { artistId: command.artistId };
          }

          await db
            .update(shopArtist)
            .set({ identitySubjectId: null })
            .where(eq(shopArtist.id, command.artistId));

          await tx.audit.append({
            actorSubjectId: command.actorSubjectId,
            capability: "catalogue.write",
            action: "unlink_artist_identity",
            targetType: "shop_artist",
            targetId: command.artistId,
            beforeJson: { identitySubjectId: before.identitySubjectId },
            afterJson: {
              identitySubjectId: null,
              ...operatorContextAuditFields(command.operatorContext),
            },
          });

          return { artistId: command.artistId };
        },
      }),
    );
}
