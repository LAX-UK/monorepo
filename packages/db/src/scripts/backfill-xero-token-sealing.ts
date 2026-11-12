/**
 * Seals Xero OAuth tokens that are still stored in the clear, then nulls the plaintext.
 *
 * Usage from packages/db (inventory is the default and reads no key):
 *   DATABASE_URL=... pnpm db:backfill-xero-token-sealing
 *   XERO_TOKEN_DEK_KEY=... DATABASE_URL=... pnpm db:backfill-xero-token-sealing --apply
 *   XERO_TOKEN_DEK_KEY=... DATABASE_URL=... pnpm db:backfill-xero-token-sealing --verify
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
