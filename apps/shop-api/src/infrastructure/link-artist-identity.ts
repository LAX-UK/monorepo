import { shopArtist } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { eq } from "drizzle-orm";
import type { ShopTransactionEffects } from "../application/ports/shop-unit-of-work.js";
import { ShopApiError, notFound } from "../errors/shop-api-error.js";
import { isPgUniqueViolation } from "../lib/pg-errors.js";
import { shopPhaseDbSession } from "./drizzle-shop-transaction-effects.js";

type DbSession = ReturnType<typeof shopPhaseDbSession>;

async function lockArtistRow(
  db: DbSession,
  artistId: string,
): Promise<{ id: string; identitySubjectId: string | null }> {
  const [artist] = await db
    .select({ id: shopArtist.id, identitySubjectId: shopArtist.identitySubjectId })
    .from(shopArtist)
    .where(eq(shopArtist.id, artistId))
    .for("update")
    .limit(1);
  if (!artist) throw notFound("Artist");
  return artist;
}

/**
 * Gives a LAX Account the artist portal for an artist profile: the one grant behind staff's
 * "Link by email" and an accepted application. An account opens one artist's portal, and an
 * artist is opened by one account, so either clash is refused. Linking again to the same account
 * changes nothing. Audited as `link_artist_identity`.
 */
export async function linkArtistIdentityInTx(
  tx: ShopTransactionEffects,
  input: {
    artistId: string;
    identitySubjectId: string;
    actorSubjectId: string;
    /** The capability the actor used; staff linking by hand use `catalogue.write`. */
    capability?: string;
    /** Extra facts for the audit entry: how the account was found, who asked. */
    auditContext?: Record<string, unknown>;
  },
): Promise<{ artistId: string; identitySubjectId: string; changed: boolean }> {
  const db = shopPhaseDbSession(tx);
  const before = await lockArtistRow(db, input.artistId);
  const result = { artistId: input.artistId, identitySubjectId: input.identitySubjectId };

  if (before.identitySubjectId === input.identitySubjectId) return { ...result, changed: false };
  if (before.identitySubjectId != null) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.CONFLICT,
      "Artist is already linked to a different login",
      409,
    );
  }

  const [otherArtist] = await db
    .select({ id: shopArtist.id })
    .from(shopArtist)
    .where(eq(shopArtist.identitySubjectId, input.identitySubjectId))
    .limit(1);
  if (otherArtist && otherArtist.id !== input.artistId) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.CONFLICT,
      "Login is already linked to another artist",
      409,
    );
  }

  try {
    await db
      .update(shopArtist)
      .set({ identitySubjectId: input.identitySubjectId })
      .where(eq(shopArtist.id, input.artistId));
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
    actorSubjectId: input.actorSubjectId,
    capability: input.capability ?? "catalogue.write",
    action: "link_artist_identity",
    targetType: "shop_artist",
    targetId: input.artistId,
    beforeJson: { identitySubjectId: before.identitySubjectId },
    afterJson: { identitySubjectId: input.identitySubjectId, ...input.auditContext },
  });
  return { ...result, changed: true };
}
