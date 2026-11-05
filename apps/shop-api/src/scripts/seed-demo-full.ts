import { closeDb, createDb } from "@auction/db";
import { assertDemoSeedTarget, seedDemoFull } from "../infrastructure/seed/demo-full-seed.js";

const url = assertDemoSeedTarget({
  databaseUrl: process.env.DATABASE_URL_SHOP,
  nodeEnv: process.env.NODE_ENV,
  appEnv: process.env.APP_ENV,
});
const db = createDb(url);
try {
  const counts = await seedDemoFull(db);
  console.log(`shop-api: demo-full seed complete ${JSON.stringify(counts)}`);
} finally {
  await closeDb(db);
}
