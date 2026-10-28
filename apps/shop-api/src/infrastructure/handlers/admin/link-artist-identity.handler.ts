import { shopArtist } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { operatorContextAuditFields } from "../../../application/admin/operator-context.js";
import { withAdminIdempotency } from "../../../application/admin/with-admin-idempotency.js";
import type { ShopUnitOfWorkFactory } from "../../../application/ports/shop-unit-of-work.js";
import { notFound } from "../../../errors/shop-api-error.js";
import { shopPhaseDbSession } from "../../drizzle-shop-transaction-effects.js";
import { linkArtistIdentityInTx } from "../../link-artist-identity.js";
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
          const profile = await resolveActiveProfileByEmail(shopPhaseDbSession(tx), command.email);
          const linked = await linkArtistIdentityInTx(tx, {
            artistId: command.artistId,
            identitySubjectId: profile.identitySubjectId,
            actorSubjectId: command.actorSubjectId,
            auditContext: {
              email: command.email.trim().toLowerCase(),
              ...operatorContextAuditFields(command.operatorContext),
            },
          });
          return { artistId: linked.artistId, identitySubjectId: linked.identitySubjectId };
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
