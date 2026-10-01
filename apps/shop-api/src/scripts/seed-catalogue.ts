import { createShopApiContainer } from "../container.js";
import { loadShopApiEnv } from "../env.js";

const force = process.argv.includes("--force");
const env = loadShopApiEnv();
if (env.NODE_ENV === "production" && !force) {
  console.error("Refusing to seed catalogue in production without --force");
  process.exit(1);
}
const container = createShopApiContainer(env);

try {
  await container.seedCatalogue();
  console.log("shop-api: foundation catalogue and storefront curation seed complete");
} finally {
  await container.close();
}
