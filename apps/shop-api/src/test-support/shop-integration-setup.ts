import { createDbFromPool } from "@auction/db";
import { applyApplicationRoleGrants } from "@auction/db/migrate-roles";
import type pg from "pg";

export const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL;
export const shopUrl = process.env.DATABASE_URL_SHOP;
export const integrationRequired = process.env.SHOP_V1_INTEGRATION_REQUIRED === "true";

if (integrationRequired && (!ownerUrl || !shopUrl)) {
  throw new Error(
    "SHOP_V1_INTEGRATION_REQUIRED is set but MIGRATION_TEST_DATABASE_URL or DATABASE_URL_SHOP is missing",
  );
}

export const hasShopIntegrationDb = Boolean(ownerUrl && shopUrl);

export async function setupShopIntegrationPools(): Promise<{
  ownerPool: pg.Pool;
  shopPool: pg.Pool;
}> {
  if (!ownerUrl || !shopUrl) {
    throw new Error("Integration test database URLs are required");
  }
  const { default: pgModule } = await import("pg");
  const ownerPool = new pgModule.Pool({ connectionString: ownerUrl });
  const shopPool = new pgModule.Pool({ connectionString: shopUrl });
  // CI applies grants once via db:roles before turbo test; avoid racing applyApplicationRoleGrants.
  if (process.env.CI !== "true" && process.env.CI !== "1") {
    await applyApplicationRoleGrants(ownerUrl);
  }
  return { ownerPool, shopPool };
}

export function createShopDb(shopPool: pg.Pool) {
  return createDbFromPool(shopPool);
}
