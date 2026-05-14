/**
 * @deprecated Use `pnpm --filter @auction/db db:seed:dev` (or `db:seed:prod`).
 * Thin shim for backwards compatibility — defaults to the comprehensive dev/demo seed.
 */
import { runSeedCli } from "./seed/runners/cli.js";

await runSeedCli(process.argv.slice(2));
