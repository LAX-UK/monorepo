import { shopDispute, shopFulfilment, shopRefund } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPublishedArtworkImportWriter } from "../../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../../test-support/shop-integration-setup.js";
import { createDrizzleSaleAuthorityWriter } from "../drizzle-sale-authority.writer.js";
import { seedShopFoundationCatalogue } from "./catalogue-seed.js";
import { seedDemoStaffQueues } from "./demo-staff-queues-seed.js";

describe.skipIf(!hasShopIntegrationDb)("demo staff queues seed (Shop)", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  it("leaves an order to fulfil, a pending refund and an open dispute, and is idempotent", async () => {
    const db = createShopDb(shopPool);
    const importWriter = createPublishedArtworkImportWriter(db, "off");
    const authorityWriter = createDrizzleSaleAuthorityWriter(db, "off");
    await seedShopFoundationCatalogue(
      importWriter.importArtwork.bind(importWriter),
      db,
      authorityWriter.grantSaleAuthority.bind(authorityWriter),
    );

    const first = await seedDemoStaffQueues(db);
    const second = await seedDemoStaffQueues(db);

    expect(first.paidOrders).toBeGreaterThan(0);
    expect(first.ordersToFulfil).toBeGreaterThan(0);
    expect(first.pendingRefunds).toBe(1);
    expect(first.openDisputes).toBe(1);
    expect(second).toEqual(first);
    const refunds = await db.select().from(shopRefund).where(eq(shopRefund.status, "pending"));
    expect(refunds.length).toBeGreaterThanOrEqual(1);
    const disputes = await db.select().from(shopDispute).where(eq(shopDispute.status, "opened"));
    expect(disputes.length).toBeGreaterThanOrEqual(1);
    expect((await db.select().from(shopFulfilment)).length).toBeGreaterThan(0);
  });
});
