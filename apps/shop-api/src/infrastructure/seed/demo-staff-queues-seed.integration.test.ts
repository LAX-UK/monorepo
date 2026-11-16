import { createDbFromPool } from "@auction/db";
import {
  domainEvent,
  shopAdminAudit,
  shopDispute,
  shopFulfilment,
  shopProcessedPaymentEvent,
  shopRefund,
} from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
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
  DEMO_DISPUTE_EVENT_ID,
  DEMO_DISPUTE_ID,
  DEMO_REFUND_KEY,
  MISSING_INTENT_ERROR,
  seedDemoStaffQueues,
} from "./demo-staff-queues-seed.js";

describe.skipIf(!hasShopIntegrationDb)("demo staff queues seed (Shop)", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
    // Only the owner can mark a database; the shared integration database is a local one.
    await ownerPool.query(
      `insert into demo_seed_target (environment, database_name, marked_by)
       values ('local', current_database(), 'shop integration test') on conflict do nothing`,
    );
    // The integration database is shared and kept between runs: start from no demo queue items.
    await ownerPool.query("delete from shop_admin_idempotency where idempotency_key = $1", [
      DEMO_REFUND_KEY,
    ]);
    await ownerPool.query("delete from shop_admin_command where idempotency_key = $1", [
      DEMO_REFUND_KEY,
    ]);
    await ownerPool.query("delete from shop_refund where idempotency_key = $1", [DEMO_REFUND_KEY]);
    await ownerPool.query("delete from shop_dispute where stripe_dispute_id = $1", [
      DEMO_DISPUTE_ID,
    ]);
    await ownerPool.query("delete from shop_processed_payment_event where event_id = $1", [
      DEMO_DISPUTE_EVENT_ID,
    ]);
    const db = createShopDb(shopPool);
    const importWriter = createPublishedArtworkImportWriter(db, "off");
    const authorityWriter = createDrizzleSaleAuthorityWriter(db, "off");
    await seedShopFoundationCatalogue(
      importWriter.importArtwork.bind(importWriter),
      db,
      authorityWriter.grantSaleAuthority.bind(authorityWriter),
    );
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  it("fills fulfilment, failed refunds and disputes through the real handlers", async () => {
    const db = createShopDb(shopPool);
    const counts = await seedDemoStaffQueues(db);
    expect(counts.paidOrders).toBeGreaterThan(0);
    expect(counts.ordersToFulfil).toBeGreaterThan(0);
    expect(counts.failedRefunds).toBe(1);
    expect(counts.openDisputes).toBe(1);

    const [refund] = await db
      .select()
      .from(shopRefund)
      .where(eq(shopRefund.idempotencyKey, DEMO_REFUND_KEY));
    // Never pending, so the refund scheduler never submits it or reports it to Sentry.
    expect(refund?.status).toBe("failed");
    expect(refund?.stripeRefundId).toBeNull();
    expect(refund?.lastError).toBe(MISSING_INTENT_ERROR);
    const audit = await db
      .select()
      .from(shopAdminAudit)
      .where(
        and(
          eq(shopAdminAudit.action, "request_refund"),
          eq(shopAdminAudit.targetId, refund?.id ?? ""),
        ),
      );
    expect(audit).toHaveLength(1);
    const requested = await db
      .select()
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.eventType, "shop.refund.requested"),
          eq(domainEvent.aggregateId, refund?.id ?? ""),
        ),
      );
    expect(requested).toHaveLength(1);

    // No demo order is given an invented Stripe payment intent, and the dispute is not on the
    // refund's order.
    const intents = await ownerPool.query(
      "select count(*)::int as n from shop_order where idempotency_key like 'seed:edition-order:%' and stripe_payment_intent_id is not null",
    );
    expect(intents.rows[0].n).toBe(0);

    const [dispute] = await db
      .select()
      .from(shopDispute)
      .where(eq(shopDispute.stripeDisputeId, DEMO_DISPUTE_ID));
    const opened = await db
      .select()
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.eventType, "shop.dispute.opened"),
          eq(domainEvent.aggregateId, dispute?.id ?? ""),
        ),
      );
    expect(opened).toHaveLength(1);
    const claims = await db
      .select()
      .from(shopProcessedPaymentEvent)
      .where(eq(shopProcessedPaymentEvent.eventId, DEMO_DISPUTE_EVENT_ID));
    expect(claims).toHaveLength(1);
    expect((await db.select().from(shopFulfilment)).length).toBeGreaterThan(0);
  });

  it("never undoes what staff did: a re-run leaves a settled refund and a won dispute alone", async () => {
    const db = createShopDb(shopPool);
    await seedDemoStaffQueues(db);
    // Staff settle the refund outside Stripe and Stripe closes the dispute in our favour.
    await ownerPool.query(
      `update shop_refund set status = 'cancelled', last_error = 'staff: settled by bank transfer'
        where idempotency_key = $1`,
      [DEMO_REFUND_KEY],
    );
    await ownerPool.query(
      `update shop_dispute set status = 'won', closed_at = now() where stripe_dispute_id = $1`,
      [DEMO_DISPUTE_ID],
    );
    const before = await ownerPool.query(
      `select (select row_to_json(r) from shop_refund r where idempotency_key = $1) as refund,
              (select row_to_json(d) from shop_dispute d where stripe_dispute_id = $2) as dispute,
              (select count(*) from shop_refund) as refunds,
              (select count(*) from domain_events where event_type in ('shop.refund.requested', 'shop.dispute.opened')) as events`,
      [DEMO_REFUND_KEY, DEMO_DISPUTE_ID],
    );

    const counts = await seedDemoStaffQueues(db);

    const after = await ownerPool.query(
      `select (select row_to_json(r) from shop_refund r where idempotency_key = $1) as refund,
              (select row_to_json(d) from shop_dispute d where stripe_dispute_id = $2) as dispute,
              (select count(*) from shop_refund) as refunds,
              (select count(*) from domain_events where event_type in ('shop.refund.requested', 'shop.dispute.opened')) as events`,
      [DEMO_REFUND_KEY, DEMO_DISPUTE_ID],
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
    expect(counts.failedRefunds).toBe(0);
    expect(counts.openDisputes).toBe(0);
  });

  it("refuses a database without the demo seed mark and writes nothing", async () => {
    const client = await ownerPool.connect();
    try {
      await client.query("begin");
      // Uncommitted, so other sessions still see the mark.
      await client.query("delete from demo_seed_target");
      const refunds = await client.query("select count(*) from shop_refund");
      const db = createDbFromPool(client as unknown as pg.Pool);
      await expect(seedDemoStaffQueues(db)).rejects.toThrow(/not marked as a demo seed target/);
      expect((await client.query("select count(*) from shop_refund")).rows).toEqual(refunds.rows);
    } finally {
      await client.query("rollback");
      client.release();
    }
  });
});
