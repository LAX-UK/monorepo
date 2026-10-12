import { createShopApiContainer } from "../container.js";
import { loadShopApiEnv } from "../env.js";
import { seedEditorialShowcase } from "../infrastructure/seed/editorial-showcase-seed.js";

const force = process.argv.includes("--force");
const env = loadShopApiEnv();
if (env.NODE_ENV === "production" && !force) {
  console.error("Refusing to seed editorial showcase in production without --force");
  process.exit(1);
}
if (!env.SHOP_EDITORIAL_ENABLED) {
  console.error("SHOP_EDITORIAL_ENABLED must be true to seed editorial showcase");
  process.exit(1);
}

const container = createShopApiContainer(env);

try {
  await seedEditorialShowcase(container.db);
  console.log("shop-api: editorial showcase seed complete");
} finally {
  await container.close();
}
