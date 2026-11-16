import { createDbFromPool } from "@auction/db";
import {
  shopAdminAudit,
  shopArtwork,
  shopEditionEvent,
  shopFulfilment,
  shopOrder,
  shopOrderLine,
  shopOriginalSale,
  shopRefund,
  shopReturn,
} from "@auction/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createPublishedArtworkImportWriter } from "../../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../../test-support/shop-integration-setup.js";
import { createDrizzleSaleAuthorityWriter } from "../drizzle-sale-authority.writer.js";
import { seedShopFoundationCatalogue } from "./catalogue-seed.js";
import { seedDemoFull } from "./demo-full-seed.js";
import {
  DEMO_CARRIER,
  DEMO_RESERVED_ORIGINAL_SLUG,
  DEMO_STATES_ACTOR,
  DEMO_TRACKING_NUMBER,
  DISPATCHED_ORDER_KEY,
  DemoShopStatesPreconditionError,
  RETURNED_ORDER_KEY,
  seedDemoShopStates,
} from "./demo-shop-states-seed.js";
import { MISSING_INTENT_ERROR } from "./demo-staff-queues-seed.js";

// Lets a test stop a run part-way, as a crash or a lost connection would.
const failAt = vi.hoisted(() => ({
  fulfilment: null as string | null,
  returnTo: null as string | null,
}));
vi.mock("../handlers/admin/update-fulfilment.handler.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../handlers/admin/update-fulfilment.handler.js")>();
  return {
    ...actual,
    createUpdateFulfilmentHandler: (
      deps: Parameters<typeof actual.createUpdateFulfilmentHandler>[0],
    ) => {
      const handler = actual.createUpdateFulfilmentHandler(deps);
      return (command: Parameters<typeof handler>[0]) => {
        if (failAt.fulfilment && command.idempotencyKey.endsWith(failAt.fulfilment)) {
          failAt.fulfilment = null;
          throw new Error("simulated stop");
        }
        return handler(command);
      };
    },
  };
});
vi.mock("../handlers/admin/advance-return.handler.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../handlers/admin/advance-return.handler.js")>();
  return {
    ...actual,
    createAdvanceReturnHandler: (deps: Parameters<typeof actual.createAdvanceReturnHandler>[0]) => {
      const handler = actual.createAdvanceReturnHandler(deps);
      return (command: Parameters<typeof handler>[0]) => {
        if (failAt.returnTo && command.to === failAt.returnTo) {
          failAt.returnTo = null;
          throw new Error("simulated stop");
        }
        return handler(command);
      };
    },
  };
});

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

  it("finishes the steps of a run that stopped part-way", async () => {
    const db = createShopDb(shopPool);
    // Stops after the dispatched order reached in production.
    failAt.fulfilment = "dispatched:awaiting_dispatch";
    await expect(seedDemoShopStates(db)).rejects.toThrow("simulated stop");
    // Stops after the cancellation, with the return still requested.
    failAt.returnTo = "in_transit";
    await expect(seedDemoShopStates(db)).rejects.toThrow("simulated stop");
    const [open] = await db
      .select({ status: shopReturn.status })
      .from(shopReturn)
      .innerJoin(shopOrderLine, eq(shopOrderLine.id, shopReturn.orderLineId))
      .innerJoin(shopOrder, eq(shopOrder.id, shopOrderLine.orderId))
      .where(eq(shopOrder.idempotencyKey, RETURNED_ORDER_KEY));
    expect(open?.status).toBe("requested");

    const counts = await seedDemoShopStates(db);
    expect(counts).toEqual({
      dispatchedOrders: 1,
      returnedOrders: 1,
      reservedOriginals: 1,
      skipped: [],
    });
  });

  it("dispatches one order, returns another and reserves one original, and a re-run adds nothing", async () => {
    const db = createShopDb(shopPool);
    const counts = await seedDemoShopStates(db);
    expect(counts.dispatchedOrders).toBe(1);
    expect(counts.returnedOrders).toBe(1);
    expect(counts.reservedOriginals).toBe(1);
    expect(counts.skipped).toEqual([]);

    const dispatched = await db
      .select()
      .from(shopFulfilment)
      .where(eq(shopFulfilment.trackingNumber, DEMO_TRACKING_NUMBER));
    expect(dispatched.length).toBeGreaterThanOrEqual(1);
    expect(dispatched[0]?.carrier).toBe(DEMO_CARRIER);
    expect(dispatched[0]?.dispatchedAt).not.toBeNull();

    // The orders are the ones named by key.
    const named = await db
      .select({ id: shopOrder.id, key: shopOrder.idempotencyKey })
      .from(shopOrder)
      .where(inArray(shopOrder.idempotencyKey, [DISPATCHED_ORDER_KEY, RETURNED_ORDER_KEY]));
    const idOf = (key: string) => named.find((o) => o.key === key)?.id;
    expect(dispatched.map((f) => f.orderId)).toContain(idOf(DISPATCHED_ORDER_KEY));

    // Packing went through the real packing service: print history, event and audit, as for staff.
    for (const key of [DISPATCHED_ORDER_KEY, RETURNED_ORDER_KEY]) {
      const history = await db
        .select()
        .from(shopEditionEvent)
        .where(
          and(
            eq(shopEditionEvent.orderId, idOf(key) ?? ""),
            eq(shopEditionEvent.kind, "pack_confirmed"),
          ),
        );
      expect(history).toHaveLength(1);
      expect(history[0]?.actorSubjectId).toBe(DEMO_STATES_ACTOR);
    }
    const packAudit = await db
      .select()
      .from(shopAdminAudit)
      .where(
        and(
          eq(shopAdminAudit.action, "confirm_print"),
          eq(shopAdminAudit.actorSubjectId, DEMO_STATES_ACTOR),
        ),
      );
    expect(packAudit).toHaveLength(2);
    const packEvents = await ownerPool.query(
      `select count(*)::int as n from domain_events
       where event_type = 'shop.print.pack_confirmed' and payload->>'orderId' = any($1)`,
      [[idOf(DISPATCHED_ORDER_KEY), idOf(RETURNED_ORDER_KEY)]],
    );
    expect(packEvents.rows[0].n).toBe(2);

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

  it("never undoes staff work: a re-run leaves a sold original sold", async () => {
    const db = createShopDb(shopPool);
    await seedDemoShopStates(db);
    // Staff complete the seeded sale: the writer marks the original sold.
    await ownerPool.query(
      "update shop_original_sale set status = 'assigned' where recorded_by_subject_id = $1",
      [DEMO_STATES_ACTOR],
    );
    await ownerPool.query("update shop_artwork set sale_state = 'sold' where slug = $1", [
      DEMO_RESERVED_ORIGINAL_SLUG,
    ]);
    await seedDemoFull(db);
    const result = await seedDemoShopStates(db);
    const [artwork] = await db
      .select({ saleState: shopArtwork.saleState })
      .from(shopArtwork)
      .where(eq(shopArtwork.slug, DEMO_RESERVED_ORIGINAL_SLUG));
    expect(artwork?.saleState).toBe("sold");
    expect(result.reservedOriginals).toBe(0);
    expect(result.skipped).toEqual([expect.stringContaining("is assigned now; left as is")]);
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
    expect(counts.skipped).toEqual([expect.stringContaining("is cancelled now; left as is")]);
    const rows = await db
      .select()
      .from(shopOriginalSale)
      .where(eq(shopOriginalSale.recordedBySubjectId, DEMO_STATES_ACTOR));
    expect(rows).toHaveLength(1);
  });

  it("fails loudly, naming what is missing, when the original to reserve is not there", async () => {
    const client = await ownerPool.connect();
    try {
      await client.query("begin");
      await client.query("update shop_artwork set slug = 'renamed-orchard' where slug = $1", [
        DEMO_RESERVED_ORIGINAL_SLUG,
      ]);
      const db = createDbFromPool(client as unknown as pg.Pool);
      const run = seedDemoShopStates(db);
      await expect(run).rejects.toBeInstanceOf(DemoShopStatesPreconditionError);
      await expect(run).rejects.toThrow(/reserved original: no lax.art original "quiet-orchard"/);
    } finally {
      await client.query("rollback");
      client.release();
    }
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
