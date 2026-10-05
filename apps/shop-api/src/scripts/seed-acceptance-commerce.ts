import { createShopApiContainer } from "../container.js";
import { loadShopApiEnv } from "../env.js";
import { resetAcceptanceCommerceState } from "../infrastructure/seed/acceptance-commerce-seed.js";

const env = loadShopApiEnv();
if (env.NODE_ENV === "production" && !process.argv.includes("--force")) {
  console.error("Refusing to reset acceptance commerce fixtures in production without --force");
  process.exit(1);
}

const container = createShopApiContainer(env);

try {
  const identitySubjectId = process.env.SHOP_ACCEPTANCE_PORTAL_SUBJECT_ID?.trim();
  await resetAcceptanceCommerceState(container.db, identitySubjectId ? { identitySubjectId } : {});
  console.log(
    "shop-api: acceptance commerce fixtures reset (sellable stock + buyer state restored)",
  );
} finally {
  await container.close();
}
