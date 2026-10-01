import { shopFulfilment, shopOrder } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  completeFixtureOrderPayment,
  createPendingPaymentOrderWithReservedEdition,
  grantLaxSaleAuthority,
  importTestArtwork,
  integrationSuffix,
} from "../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";

describe.skipIf(!hasShopIntegrationDb)("shop reaudit payment fulfilment", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await ownerPool.end();
    await shopPool.end();
  });

  it("creates shop_fulfilment when checkout completes", async () => {
    const db = createShopDb(shopPool);
    const suffix = integrationSuffix("reaudit-fulfilment");
    const imported = await importTestArtwork(db, "reaudit-fulfilment");
    await grantLaxSaleAuthority(db, imported.artworkId, 1);
    const pending = await createPendingPaymentOrderWithReservedEdition(db, {
      artworkId: imported.artworkId,
      suffix,
    });
    await completeFixtureOrderPayment(db, pending, `evt-reaudit-${suffix}`);

    const [order] = await db
      .select({ status: shopOrder.status })
      .from(shopOrder)
      .where(eq(shopOrder.id, pending.orderId))
      .limit(1);
    expect(order?.status).toBe("paid");

    const [fulfilment] = await db
      .select({ id: shopFulfilment.id })
      .from(shopFulfilment)
      .where(eq(shopFulfilment.orderId, pending.orderId))
      .limit(1);
    expect(fulfilment).toBeDefined();
  });
});
