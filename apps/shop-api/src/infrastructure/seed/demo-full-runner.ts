import { type Database, type SeedTargetEnv, assertSeedTarget } from "@auction/db";
import { seedDemoFull } from "./demo-full-seed.js";
import { seedDemoShopStates } from "./demo-shop-states-seed.js";
import { seedDemoStaffQueues } from "./demo-staff-queues-seed.js";

/**
 * What `seed:demo-full` runs: the database must carry the demo seed mark (0398), whatever its
 * address looks like, before anything is written. After the catalogue states and the staff
 * queues it seeds the dispatched, returned and reserved states.
 */
export async function runShopDemoFull(
  db: Database,
  env: SeedTargetEnv,
  steps: {
    full: typeof seedDemoFull;
    queues: typeof seedDemoStaffQueues;
    states: typeof seedDemoShopStates;
  } = {
    full: seedDemoFull,
    queues: seedDemoStaffQueues,
    states: seedDemoShopStates,
  },
): Promise<{
  counts: Record<string, number>;
  queues: Awaited<ReturnType<typeof seedDemoStaffQueues>>;
  states: Awaited<ReturnType<typeof seedDemoShopStates>>;
}> {
  await assertSeedTarget(db, "shop demo-full", env);
  const counts = await steps.full(db);
  const queues = await steps.queues(db);
  // Throws, naming each missing precondition, when a state cannot be seeded at all.
  const states = await steps.states(db);
  return { counts, queues, states };
}
