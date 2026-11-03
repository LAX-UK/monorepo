import process from "node:process";
import { restoreJwksActiveKey } from "../packages/identity-db/src/adapters/drizzle-jwks-rotation.ts";
import { closeIdentityDb, createIdentityDb } from "../packages/identity-db/src/client.ts";

/**
 * Backs out a signing-key rotation: makes the given key the active key again and retires
 * every other active key. Run through the jwks-restore-active workflow, which supplies the
 * owner database URL:
 *   DATABASE_URL_OWNER=... pnpm jwks:restore-active --kid <kid> [--dry-run]
 */

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const kid = argValue("--kid")?.trim();
  if (!kid) throw new Error("--kid is required");
  if (process.argv.includes("--dry-run")) {
    console.log(`Dry run: would make ${kid} the active key and retire every other active key.`);
    return;
  }
  const url = process.env.DATABASE_URL_OWNER;
  if (!url) throw new Error("DATABASE_URL_OWNER is required");
  const db = createIdentityDb(url);
  try {
    const result = await restoreJwksActiveKey(db, { kid });
    console.log(`Active kid: ${result.restoredKid}`);
    console.log(`Retired: ${result.retiredKids.join(", ") || "none"}`);
  } finally {
    await closeIdentityDb(db);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
