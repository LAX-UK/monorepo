import { closeDb, createDb, seedTargetEnvFromProcess } from "@auction/db";
import { runShopDemoFull } from "../infrastructure/seed/demo-full-runner.js";
import { assertDemoSeedTarget } from "../infrastructure/seed/demo-full-seed.js";

const env = seedTargetEnvFromProcess("DATABASE_URL_SHOP");
const url = assertDemoSeedTarget(env);
const db = createDb(url);
try {
  const { counts, queues } = await runShopDemoFull(db, env);
  console.log(`shop-api: demo staff queues ${JSON.stringify(queues)}`);
  console.log(`shop-api: demo-full seed complete ${JSON.stringify(counts)}`);
} finally {
  await closeDb(db);
}
