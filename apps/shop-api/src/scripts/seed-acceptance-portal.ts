import { createShopApiContainer } from "../container.js";
import { loadShopApiEnv } from "../env.js";
import {
  SHOP_ACCEPTANCE_OWNED_ARTWORK_TITLE,
  seedAcceptancePortalFixtures,
} from "../infrastructure/seed/acceptance-portal-seed.js";
import { assertAcceptanceSeedTarget } from "../infrastructure/seed/acceptance-seed-target.js";

const env = loadShopApiEnv();

const identitySubjectId = process.env.SHOP_ACCEPTANCE_PORTAL_SUBJECT_ID?.trim();
if (!identitySubjectId) {
  console.error("SHOP_ACCEPTANCE_PORTAL_SUBJECT_ID is required");
  process.exit(1);
}

const container = createShopApiContainer(env);

try {
  await assertAcceptanceSeedTarget(container.db, "shop acceptance portal", env.DATABASE_URL_SHOP);
  await seedAcceptancePortalFixtures(
    container.db,
    (command) => container.grantSaleAuthority(command),
    {
      identitySubjectId,
      ...(process.env.SHOP_ACCEPTANCE_PORTAL_DISPLAY_NAME?.trim()
        ? { displayName: process.env.SHOP_ACCEPTANCE_PORTAL_DISPLAY_NAME.trim() }
        : {}),
    },
  );
  console.log(
    `shop-api: acceptance portal seed complete (owned artwork: ${SHOP_ACCEPTANCE_OWNED_ARTWORK_TITLE})`,
  );
} finally {
  await container.close();
}
