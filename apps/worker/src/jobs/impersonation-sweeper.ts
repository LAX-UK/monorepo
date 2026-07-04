import type pino from "pino";
import type { IImpersonationSweepRepository } from "../interfaces/impersonation-sweep.repository.js";

/** close impersonation sessions that never received an explicit `ended`
 * event (browser closed, worker crash, etc.).
 */
export async function runImpersonationSweeperJob(input: {
  impersonationSweepRepo: IImpersonationSweepRepository;
  log: pino.Logger;
}): Promise<void> {
  const { impersonationSweepRepo, log } = input;
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  const inserted = await impersonationSweepRepo.sweepStaleSessions(cutoff, 500);
  if (inserted > 0) {
    log.info({ inserted }, "impersonation_sweeper_inserted_timeout_ends");
  }
}
