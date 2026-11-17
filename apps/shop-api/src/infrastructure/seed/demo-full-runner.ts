import { type Database, type SeedTargetEnv, assertSeedTarget } from "@auction/db";
import { seedDemoFull } from "./demo-full-seed.js";
import { seedDemoStaffQueues } from "./demo-staff-queues-seed.js";

/**
 * What `seed:demo-full` runs: the database must carry the demo seed mark (0398), whatever its
 * address looks like, before anything is written.
 */
export async function runShopDemoFull(
  db: Database,
  env: SeedTargetEnv,
  steps: { full: typeof seedDemoFull; queues: typeof seedDemoStaffQueues } = {
    full: seedDemoFull,
    queues: seedDemoStaffQueues,
  },
): Promise<{
  counts: Record<string, number>;
  queues: Awaited<ReturnType<typeof seedDemoStaffQueues>>;
}> {
  await assertSeedTarget(db, "shop demo-full", env);
  const counts = await steps.full(db);
  const queues = await steps.queues(db);
  return { counts, queues };
}
