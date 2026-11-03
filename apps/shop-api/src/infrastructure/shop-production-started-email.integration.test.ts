import type { Database } from "@auction/db";
import { emailOutbox, shopOrder, shopOrderLine, shopUserProfile } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  completeFixtureOrderPayment,
  createPendingPaymentOrderWithReservedEdition,
  grantLaxSaleAuthority,
  importTestArtwork,
  integrationSuffix,
  requireDefined,
} from "../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleShopUnitOfWork } from "./drizzle-shop-transaction-effects.js";
import { createCreateProductionTaskHandler } from "./handlers/admin/create-production-task.handler.js";

describe.skipIf(!hasShopIntegrationDb)("production started email integration", () => {
  let shopPool!: pg.Pool;
  let ownerPool!: pg.Pool;
  let db!: Database;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
    db = createShopDb(shopPool);
  });

  afterAll(async () => {
    await Promise.allSettled([ownerPool.end(), shopPool.end()]);
  });

  async function paidOrder(label: string) {
    const suffix = integrationSuffix(label);
    const imported = await importTestArtwork(db, label);
    await grantLaxSaleAuthority(db, imported.artworkId, 1);
    const pending = await createPendingPaymentOrderWithReservedEdition(db, {
      artworkId: imported.artworkId,
      suffix,
      totalPence: 3_000,
    });
    await completeFixtureOrderPayment(db, pending, `evt-${suffix}`);
    await db
      .insert(shopUserProfile)
      .values({ identitySubjectId: `subject-${suffix}`, email: `buyer-${suffix}@example.com` })
      .onConflictDoNothing();
    const [line] = await db
      .select({ id: shopOrderLine.id })
      .from(shopOrderLine)
      .where(eq(shopOrderLine.orderId, pending.orderId));
    const [order] = await db
      .select({ reference: shopOrder.reference })
      .from(shopOrder)
      .where(eq(shopOrder.id, pending.orderId));
    return {
      suffix,
      editionId: pending.editionId,
      orderLineId: requireDefined(line?.id, "order line"),
      reference: requireDefined(order?.reference, "order reference"),
    };
  }

  const outboxFor = (taskId: string) =>
    db
      .select({
        template: emailOutbox.template,
        vars: emailOutbox.vars,
        to: emailOutbox.toSnapshot,
      })
      .from(emailOutbox)
      .where(eq(emailOutbox.idempotencyKey, `production-started:${taskId}`));

  it("starting production emails the buyer once per task", async () => {
    const order = await paidOrder("production-email");
    const create = createCreateProductionTaskHandler({
      uow: createDrizzleShopUnitOfWork(db, "off"),
    });
    const command = {
      orderLineId: order.orderLineId,
      editionId: order.editionId,
      actorSubjectId: "production-staff-subject",
    };
    const first = await create({ ...command, idempotencyKey: `task-${order.suffix}` });
    const sent = await outboxFor(first.taskId);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.template).toBe("shop-production-started");
    expect(sent[0]?.to).toBe(`buyer-${order.suffix}@example.com`);
    expect(sent[0]?.vars).toMatchObject({
      orderReference: order.reference,
      artworkTitle: "Integration production-email",
    });

    // A second request for the same line finds the task and sends nothing more.
    const second = await create({ ...command, idempotencyKey: `task-again-${order.suffix}` });
    expect(second.taskId).toBe(first.taskId);
    expect(await outboxFor(first.taskId)).toHaveLength(1);
  });
});
