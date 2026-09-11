/**
 * Inventory (default), apply (`--apply`), or verify (`--verify`) auth at-rest encryption.
 *
 * Usage from packages/db:
 *   AUTH_DEK_KEY=... DATABASE_URL_AUTH=... pnpm db:backfill-auth-at-rest
 *   AUTH_DEK_KEY=... DATABASE_URL_AUTH=... pnpm db:backfill-auth-at-rest --apply
 *   AUTH_DEK_KEY=... DATABASE_URL_AUTH=... pnpm db:backfill-auth-at-rest --verify
 */
import { main } from "../auth-at-rest/run.js";

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
