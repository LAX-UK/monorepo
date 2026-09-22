import { createShopApiContainer } from "../container.js";
import { loadShopApiEnv } from "../env.js";

const env = loadShopApiEnv();
const container = createShopApiContainer(env);

try {
  await container.seedCatalogue();
  console.log("shop-api: foundation catalogue and storefront curation seed complete");
} finally {
  await container.close();
}
