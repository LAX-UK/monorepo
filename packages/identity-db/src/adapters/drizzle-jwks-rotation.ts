import { eq, sql } from "drizzle-orm";
import { jwksKey } from "../schema/jwks-key.js";
import type { IdentityDatabase } from "./drizzle-consent-store.js";
import { JWKS_ADVISORY_LOCK_KEY } from "./drizzle-jwks-retirement.js";
import { createDrizzleJwksStore } from "./drizzle-jwks-store.js";
import type { EnvelopeCrypto } from "./envelope.js";
import { encryptPrivateKeyForBetterAuth } from "./signing-key-encryption.js";

export type NewSigningKey = {
  /** Public JWK as JSON. */
  publicKey: string;
  /**
   * Private JWK as JSON. It is encrypted with the auth secret, as Better Auth
   * does, and then sealed with the envelope before it is stored.
   */
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
  input: { key: NewSigningKey; authSecret: string; envelope?: EnvelopeCrypto; now?: Date },
): Promise<JwksRotationResult> {
  const now = input.now ?? new Date();
  const privateKey = await encryptPrivateKeyForBetterAuth({
    privateJwkJson: input.key.privateKey,
    authSecret: input.authSecret,
  });
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
      privateKey,
      alg: input.key.alg,
      createdAt: now,
    });
    return { newKid: created.id, rotatedKids: demoted.map((row) => row.kid) };
  });
}
