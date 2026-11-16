import { assertSeedTarget, closeDb, createDb, seedTargetEnvFromProcess } from "@auction/db";
import { assertDemoSeedTarget, seedDemoFull } from "../infrastructure/seed/demo-full-seed.js";
import { seedDemoStaffQueues } from "../infrastructure/seed/demo-staff-queues-seed.js";

const env = seedTargetEnvFromProcess("DATABASE_URL_SHOP");
const url = assertDemoSeedTarget(env);
const db = createDb(url);
try {
  // The database must carry the demo seed mark (0398), whatever its address looks like.
  await assertSeedTarget(db, "shop demo-full", env);
  const counts = await seedDemoFull(db);
  const queues = await seedDemoStaffQueues(db);
  console.log(`shop-api: demo staff queues ${JSON.stringify(queues)}`);
  console.log(`shop-api: demo-full seed complete ${JSON.stringify(counts)}`);
} finally {
  await closeDb(db);
}
