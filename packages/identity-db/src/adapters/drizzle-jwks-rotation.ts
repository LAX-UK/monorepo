import { eq, sql } from "drizzle-orm";
import { jwksKey } from "../schema/jwks-key.js";
import type { IdentityDatabase } from "./drizzle-consent-store.js";
import { JWKS_ADVISORY_LOCK_KEY } from "./drizzle-jwks-retirement.js";
import { createDrizzleJwksStore } from "./drizzle-jwks-store.js";
import type { EnvelopeCrypto } from "./envelope.js";

export type NewSigningKey = {
  /** Public JWK as JSON. */
  publicKey: string;
  /** Private JWK as JSON; sealed with the envelope before it is stored. */
  privateKey: string;
  alg: "RS256";
};

export type JwksRotationResult = {
  newKid: string;
  /** Keys that were active and are now rotating. */
  rotatedKids: string[];
};

/**
 * Rotates the signing key in one transaction: the new key becomes active and
 * every previously active key becomes rotating with `rotated_at = now`, so
 * both stay published until the retirement schedule retires the old one.
 */
export async function rotateJwksSigningKey(
  db: IdentityDatabase,
  input: { key: NewSigningKey; envelope?: EnvelopeCrypto; now?: Date },
): Promise<JwksRotationResult> {
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(${JWKS_ADVISORY_LOCK_KEY.toString()}::bigint)`,
    );
    const demoted = await tx
      .update(jwksKey)
      .set({ status: "rotating", rotatedAt: now })
      .where(eq(jwksKey.status, "active"))
      .returning({ kid: jwksKey.kid });
    const created = await createDrizzleJwksStore(
      tx as unknown as IdentityDatabase,
      input.envelope,
    ).createJwk({
      publicKey: input.key.publicKey,
      privateKey: input.key.privateKey,
      alg: input.key.alg,
      createdAt: now,
    });
    return { newKid: created.id, rotatedKids: demoted.map((row) => row.kid) };
  });
}
