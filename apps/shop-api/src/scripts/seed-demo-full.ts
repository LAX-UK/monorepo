import { closeDb, createDb, seedTargetEnvFromProcess } from "@auction/db";
import { runShopDemoFull } from "../infrastructure/seed/demo-full-runner.js";
import { assertDemoSeedTarget } from "../infrastructure/seed/demo-full-seed.js";

const env = seedTargetEnvFromProcess("DATABASE_URL_SHOP");
const url = assertDemoSeedTarget(env);
const db = createDb(url);
try {
  const { counts, queues, states } = await runShopDemoFull(db, env);
  console.log(`shop-api: demo-full seed ${JSON.stringify(counts)}`);
  console.log(`shop-api: demo staff queues ${JSON.stringify(queues)}`);
  const { skipped, ...stateCounts } = states;
  console.log(`shop-api: demo shop states ${JSON.stringify(stateCounts)}`);
  for (const reason of skipped) console.warn(`shop-api: demo shop state not seeded: ${reason}`);
  console.log("shop-api: demo-full seed complete");
} finally {
  await closeDb(db);
}
