import process from "node:process";
import { exportJWK, generateKeyPair } from "jose";
import {
  createEnvelopeCrypto,
  parseAuthDekKey,
} from "../packages/identity-contracts/src/auth-at-rest.ts";
import { JWKS_RETIREMENT_WINDOW_MS } from "../packages/identity-db/src/adapters/drizzle-jwks-retirement.ts";
import { rotateJwksSigningKey } from "../packages/identity-db/src/adapters/drizzle-jwks-rotation.ts";
import { closeIdentityDb, createIdentityDb } from "../packages/identity-db/src/client.ts";

/**
 * Rotates the JWT signing key: creates a new active RS256 key and demotes the
 * current one to `rotating`, so both stay published. The auth service retires
 * the old key once the retirement window has passed.
 *
 * Take a snapshot first (`pnpm jwks:snapshot <env>`), then run:
 *   DATABASE_URL_OWNER=... AUTH_DEK_KEY=... pnpm jwks:rotate [--dry-run]
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const envelope = createEnvelopeCrypto(parseAuthDekKey(requireEnv("AUTH_DEK_KEY").trim()));
  const { publicKey, privateKey } = await generateKeyPair("RS256", {
    modulusLength: 2048,
    extractable: true,
  });
  const key = {
    publicKey: JSON.stringify(await exportJWK(publicKey)),
    privateKey: JSON.stringify(await exportJWK(privateKey)),
    alg: "RS256" as const,
  };
  const windowMinutes = Math.round(JWKS_RETIREMENT_WINDOW_MS / 60_000);
  if (dryRun) {
    console.log(
      `Dry run: generated and sealed a new RS256 key; database untouched. The old key would be retired ${windowMinutes} minutes after rotation.`,
    );
    return;
  }
  const db = createIdentityDb(requireEnv("DATABASE_URL_OWNER"));
  try {
    const result = await rotateJwksSigningKey(db, { key, envelope });
    console.log(`New active kid: ${result.newKid}`);
    console.log(
      `Now rotating: ${result.rotatedKids.join(", ") || "none"}. Retired automatically after ${windowMinutes} minutes.`,
    );
  } finally {
    await closeIdentityDb(db);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
