import { createDbFromPool } from "@auction/db";
import { shopFulfilment, shopOriginalSale, shopRefund, shopReturn } from "@auction/db/schema";
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
import {
  DEMO_CARRIER,
  DEMO_RESERVED_ORIGINAL_SLUG,
  DEMO_STATES_ACTOR,
  DEMO_TRACKING_NUMBER,
  seedDemoShopStates,
} from "./demo-shop-states-seed.js";
import { MISSING_INTENT_ERROR } from "./demo-staff-queues-seed.js";

describe.skipIf(!hasShopIntegrationDb)("demo shop states seed (Shop)", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
    await ownerPool.query(
      `insert into demo_seed_target (environment, database_name, marked_by)
       values ('local', current_database(), 'shop integration test') on conflict do nothing`,
    );
    const db = createShopDb(shopPool);
    await seedShopFoundationCatalogue(
      createPublishedArtworkImportWriter(db, "off").importArtwork.bind(
        createPublishedArtworkImportWriter(db, "off"),
      ),
      db,
      createDrizzleSaleAuthorityWriter(db, "off").grantSaleAuthority.bind(
        createDrizzleSaleAuthorityWriter(db, "off"),
      ),
    );
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  it("dispatches one order, returns another and reserves one original, and a re-run adds nothing", async () => {
    const db = createShopDb(shopPool);
    const counts = await seedDemoShopStates(db);
    expect(counts.dispatchedOrders).toBe(1);
    expect(counts.returnedOrders).toBe(1);
    expect(counts.reservedOriginals).toBe(1);

    const dispatched = await db
      .select()
      .from(shopFulfilment)
      .where(eq(shopFulfilment.trackingNumber, DEMO_TRACKING_NUMBER));
    expect(dispatched.length).toBeGreaterThanOrEqual(1);
    expect(dispatched[0]?.carrier).toBe(DEMO_CARRIER);
    expect(dispatched[0]?.dispatchedAt).not.toBeNull();

    // The cancellation refunds can never reach Stripe and are never left pending for the scheduler.
    const refunds = await db
      .select()
      .from(shopRefund)
      .where(eq(shopRefund.requestedBySubjectId, DEMO_STATES_ACTOR));
    expect(refunds.length).toBeGreaterThan(0);
    for (const refund of refunds) {
      expect(refund.status).toBe("failed");
      expect(refund.stripeRefundId).toBeNull();
      expect(refund.lastError).toBe(MISSING_INTENT_ERROR);
    }
    const intents = await ownerPool.query(
      "select count(*)::int as n from shop_order where idempotency_key like 'seed:edition-order:%' and stripe_payment_intent_id is not null",
    );
    expect(intents.rows[0].n).toBe(0);

    const sales = await db
      .select()
      .from(shopOriginalSale)
      .where(eq(shopOriginalSale.recordedBySubjectId, DEMO_STATES_ACTOR));
    expect(sales).toHaveLength(1);
    expect(sales[0]?.status).toBe("reserved");
    expect(DEMO_RESERVED_ORIGINAL_SLUG).toBe("quiet-orchard");

    const snapshot = () =>
      ownerPool.query(
        `select (select count(*) from shop_return) as returns,
                (select count(*) from shop_refund) as refunds,
                (select count(*) from shop_original_sale) as sales,
                (select count(*) from shop_party) as parties,
                (select count(*) from domain_events) as events,
                (select count(*) from shop_admin_audit) as audit`,
      );
    const before = await snapshot();
    const again = await seedDemoShopStates(db);
    expect((await snapshot()).rows[0]).toEqual(before.rows[0]);
    expect(again).toEqual(counts);
    const [received] = await db.select().from(shopReturn).where(eq(shopReturn.status, "received"));
    expect(received).toBeDefined();
  });

  it("never undoes staff work: a cancelled reservation is not reserved again", async () => {
    const db = createShopDb(shopPool);
    await seedDemoShopStates(db);
    await ownerPool.query(
      "update shop_original_sale set status = 'cancelled' where recorded_by_subject_id = $1",
      [DEMO_STATES_ACTOR],
    );
    const counts = await seedDemoShopStates(db);
    expect(counts.reservedOriginals).toBe(0);
    const rows = await db
      .select()
      .from(shopOriginalSale)
      .where(eq(shopOriginalSale.recordedBySubjectId, DEMO_STATES_ACTOR));
    expect(rows).toHaveLength(1);
  });

  it("refuses a database without the demo seed mark and writes nothing", async () => {
    const client = await ownerPool.connect();
    try {
      await client.query("begin");
      await client.query("delete from demo_seed_target");
      const before = await client.query("select count(*) from shop_original_sale");
      const db = createDbFromPool(client as unknown as pg.Pool);
      await expect(seedDemoShopStates(db)).rejects.toThrow(/not marked as a demo seed target/);
      expect((await client.query("select count(*) from shop_original_sale")).rows).toEqual(
        before.rows,
      );
    } finally {
      await client.query("rollback");
      client.release();
    }
  });
});
