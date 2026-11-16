import { assertDemoSeedDatabase, closeDb, createDb } from "@auction/db";
import { assertDemoSeedTarget, seedDemoFull } from "../infrastructure/seed/demo-full-seed.js";
import { seedDemoShopStates } from "../infrastructure/seed/demo-shop-states-seed.js";
import { seedDemoStaffQueues } from "../infrastructure/seed/demo-staff-queues-seed.js";

const url = assertDemoSeedTarget({
  databaseUrl: process.env.DATABASE_URL_SHOP,
  nodeEnv: process.env.NODE_ENV,
  appEnv: process.env.APP_ENV,
});
const db = createDb(url);
try {
  // The database must carry the demo seed mark (0398), whatever its address looks like.
  await assertDemoSeedDatabase(db, "shop demo-full");
  const counts = await seedDemoFull(db);
  const queues = await seedDemoStaffQueues(db);
  const states = await seedDemoShopStates(db);
  console.log(`shop-api: demo shop states ${JSON.stringify(states)}`);
  console.log(`shop-api: demo staff queues ${JSON.stringify(queues)}`);
  console.log(`shop-api: demo-full seed complete ${JSON.stringify(counts)}`);
} finally {
  await closeDb(db);
}
