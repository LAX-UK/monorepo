import { createShopApiContainer } from "../container.js";
import { loadShopApiEnv } from "../env.js";
import { resetAcceptanceStripeCheckoutFixture } from "../infrastructure/seed/acceptance-commerce-seed.js";

const env = loadShopApiEnv();
if (env.NODE_ENV === "production" && !process.argv.includes("--force")) {
  console.error("Refusing to reset acceptance commerce fixtures in production without --force");
  process.exit(1);
}

const container = createShopApiContainer(env);

try {
  await resetAcceptanceStripeCheckoutFixture(container.db);
  console.log("shop-api: acceptance commerce fixtures reset (Stripe checkout stock restored)");
} finally {
  await container.close();
}
