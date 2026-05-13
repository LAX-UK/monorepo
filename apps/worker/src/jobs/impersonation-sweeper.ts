import type { createDb } from "@auction/db";
import type pino from "pino";
import { sweepStaleImpersonationSessions } from "./impersonation-sweep-core.js";

type Db = ReturnType<typeof createDb>;

/** close impersonation sessions that never received an explicit `ended`
 * event (browser closed, worker crash, etc.).
 */
export async function runImpersonationSweeperJob(input: {
  db: Db;
  log: pino.Logger;
}): Promise<void> {
  const { db, log } = input;
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  const inserted = await sweepStaleImpersonationSessions(db, { cutoff, batchLimit: 500 });
  if (inserted > 0) {
    log.info({ inserted }, "impersonation_sweeper_inserted_timeout_ends");
  }
}
