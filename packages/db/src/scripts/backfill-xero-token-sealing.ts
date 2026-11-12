/**
 * Seals Xero OAuth tokens that are still stored in the clear, then nulls the plaintext.
 *
 * Usage from packages/db (inventory is the default and reads no key):
 *   DATABASE_URL=... pnpm db:backfill-xero-token-sealing
 *   XERO_TOKEN_DEK_KEY=... DATABASE_URL=... pnpm db:backfill-xero-token-sealing --apply
 *   XERO_TOKEN_DEK_KEY=... DATABASE_URL=... pnpm db:backfill-xero-token-sealing --verify
 *
 * Rollout order: (1) apply migration 0367, (2) deploy api and worker with XERO_TOKEN_DEK_KEY set,
 * replacing them (stop old, then start new) rather than rolling, or pausing the proactive Xero
 * refresh until no old instance remains: the new release seals and nulls the plaintext from its
 * first refresh, so an overlapping old instance would read null tokens and mark the connection
 * needs_reauth, (3) confirm no previous-release api or worker instance is still running (it writes plaintext and
 * cannot read sealed tokens), (4) --apply, (5) --verify. A plaintext value always wins over a
 * sealed one, as it can only come from a newer write by a previous release.
 */
import pg from "pg";
import { buildPgPoolConfig } from "../ssl.js";
import {
  XeroTokenSealer,
  backfillXeroTokenSealing,
  countPlaintextXeroTokens,
  verifyXeroTokensSealed,
} from "../xero-token-sealing/index.js";

async function main(): Promise<void> {
  const mode = process.argv.includes("--apply")
    ? "apply"
    : process.argv.includes("--verify")
      ? "verify"
      : "inventory";
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("Set DATABASE_URL");
  const key = process.env.XERO_TOKEN_DEK_KEY;
  if (mode !== "inventory" && !key?.trim()) {
    throw new Error("XERO_TOKEN_DEK_KEY is required for --apply and --verify");
  }
  const pool = new pg.Pool(buildPgPoolConfig(databaseUrl));
  try {
    if (mode === "inventory") {
      console.log(JSON.stringify({ plaintextConnections: await countPlaintextXeroTokens(pool) }));
      return;
    }
    const sealer = XeroTokenSealer.fromKey(key);
    if (mode === "verify") {
      await verifyXeroTokensSealed(pool, sealer);
      console.log(JSON.stringify({ status: "complete" }));
      return;
    }
    const result = await backfillXeroTokenSealing(pool, sealer);
    console.log(JSON.stringify({ status: "applied", ...result }));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
