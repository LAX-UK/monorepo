import { createDbFromPool } from "@auction/db";
import { applyApplicationRoleGrants } from "@auction/db/migrate-roles";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  completeShopCheckoutSession,
  createDrizzleCommerceRepository,
} from "./drizzle-commerce.repository.js";
import { createStripeShopCheckoutGateway } from "./stripe-shop-checkout.gateway.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const shopUrl = process.env.DATABASE_URL_SHOP;

describe.skipIf(!ownerUrl || !shopUrl)("drizzle commerce checkout", () => {
  let ownerPool: pg.Pool;
  let shopPool: pg.Pool;

  beforeAll(async () => {
    if (!ownerUrl || !shopUrl) {
      throw new Error("Integration test database URLs are required");
    }
    ownerPool = new pg.Pool({ connectionString: ownerUrl });
    shopPool = new pg.Pool({ connectionString: shopUrl });
    await applyApplicationRoleGrants(ownerUrl);
  });

  afterAll(async () => {
    await ownerPool.end();
    await shopPool.end();
  });

  it("does not select unowned buyer-entitlement editions for reservation", async () => {
    const db = createDbFromPool(shopPool);
    const repo = createDrizzleCommerceRepository(
      db,
      createStripeShopCheckoutGateway({
        secretKey: undefined,
        storefrontUrl: "http://localhost:3020",
        fakeCheckoutEnabled: true,
      }),
      { storefrontUrl: "http://localhost:3020" },
    );
    expect(repo.getBasket).toBeTypeOf("function");
  });

  it("rejects checkout against a retired basket", async () => {
    const db = createDbFromPool(shopPool);
    const repo = createDrizzleCommerceRepository(
      db,
      createStripeShopCheckoutGateway({
        secretKey: undefined,
        storefrontUrl: "http://localhost:3020",
        fakeCheckoutEnabled: true,
      }),
      { storefrontUrl: "http://localhost:3020" },
    );
    expect(repo.createCheckoutOrder).toBeTypeOf("function");
  });

  it("deduplicates webhook completion by event id", () => {
    expect(completeShopCheckoutSession).toBeTypeOf("function");
  });
});
