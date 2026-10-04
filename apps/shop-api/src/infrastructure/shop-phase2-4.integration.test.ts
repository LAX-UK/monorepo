import {
  domainEvent,
  shopIdentityMergeInbox,
  shopOrderLine,
  shopParty,
  shopPayoutLedger,
  shopRefund,
} from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ShopApiError } from "../errors/shop-api-error.js";
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
import { createMarkPayoutPaidHandler } from "./handlers/admin/mark-payout-paid.handler.js";
import { createRequestRefundHandler } from "./handlers/admin/request-refund.handler.js";
import { createProcessIdentityMergeInboxRunner } from "./scheduler/process-identity-merge-inbox.runner.js";

describe.skipIf(!hasShopIntegrationDb)("shop phase 2–4 money and merge integration", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await ownerPool.end();
    await shopPool.end();
  });

  it("two concurrent requestRefund calls on one order never exceed the order total", async () => {
    const db = createShopDb(shopPool);
    const uow = createDrizzleShopUnitOfWork(db, "off");
    const requestRefund = createRequestRefundHandler({ uow });
    const suffix = integrationSuffix("concurrent-refund");
    const imported = await importTestArtwork(db, "concurrent-refund");
    await grantLaxSaleAuthority(db, imported.artworkId, 1);
    const pending = await createPendingPaymentOrderWithReservedEdition(db, {
      artworkId: imported.artworkId,
      suffix,
      totalPence: 5_000,
    });
    await completeFixtureOrderPayment(db, pending, `evt-${suffix}`);

    const actor = "finance-integration-subject";
    const results = await Promise.allSettled([
      requestRefund({
        orderId: pending.orderId,
        amountPence: 3_000,
        actorSubjectId: actor,
        idempotencyKey: `refund-a-${suffix}`,
      }),
      requestRefund({
        orderId: pending.orderId,
        amountPence: 3_000,
        actorSubjectId: actor,
        idempotencyKey: `refund-b-${suffix}`,
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    const rejectedErr = (rejected[0] as PromiseRejectedResult).reason;
    expect(rejectedErr).toBeInstanceOf(ShopApiError);
    expect((rejectedErr as ShopApiError).code).toBe(SHOP_API_ERROR_CODES.VALIDATION);

    const refunds = await db
      .select({ amountPence: shopRefund.amountPence })
      .from(shopRefund)
      .where(eq(shopRefund.orderId, pending.orderId));
    const totalRefunded = refunds.reduce((sum, row) => sum + row.amountPence, 0);
    expect(totalRefunded).toBeLessThanOrEqual(5_000);
  });

  it("two concurrent mark-paid calls: one succeeds and one returns 409", async () => {
    const db = createShopDb(shopPool);
    const uow = createDrizzleShopUnitOfWork(db, "off");
    const markPaid = createMarkPayoutPaidHandler({ uow });
    const suffix = integrationSuffix("concurrent-mark-paid");
    const imported = await importTestArtwork(db, "mark-paid");
    await grantLaxSaleAuthority(db, imported.artworkId, 1);
    const pending = await createPendingPaymentOrderWithReservedEdition(db, {
      artworkId: imported.artworkId,
      suffix,
    });
    await completeFixtureOrderPayment(db, pending, `evt-${suffix}`);
    const [line] = await db
      .select({ id: shopOrderLine.id })
      .from(shopOrderLine)
      .where(eq(shopOrderLine.orderId, pending.orderId))
      .limit(1);
    const orderLineId = requireDefined(line?.id, "order line");

    const [payout] = await db
      .insert(shopPayoutLedger)
      .values({
        orderLineId,
        ownerPartyId: pending.sellerPartyId,
        grossPence: pending.totalPence,
        netPence: pending.totalPence,
        payoutDueAt: new Date(),
        status: "due",
        source: "order_line",
      })
      .returning({ id: shopPayoutLedger.id });
    const payoutId = requireDefined(payout?.id, "payout");

    const actor = "finance-mark-paid-subject";
    const results = await Promise.allSettled([
      markPaid({
        payoutId,
        paidReference: `REF-A-${suffix}`,
        actorSubjectId: actor,
        idempotencyKey: `mark-a-${suffix}`,
      }),
      markPaid({
        payoutId,
        paidReference: `REF-B-${suffix}`,
        actorSubjectId: actor,
        idempotencyKey: `mark-b-${suffix}`,
      }),
    ]);

    const ok = results.filter((r) => r.status === "fulfilled");
    const fail = results.filter((r) => r.status === "rejected");
    expect(ok.length).toBe(1);
    expect(fail.length).toBe(1);
    expect((fail[0] as PromiseRejectedResult).reason).toMatchObject({
      code: SHOP_API_ERROR_CODES.CONFLICT,
    });
  });

  it("identity merge with both subjects owning a party marks the row dead", async () => {
    const db = createShopDb(shopPool);
    const runMerge = createProcessIdentityMergeInboxRunner(db, null);
    const suffix = integrationSuffix("merge-dead");
    const canonicalSubjectId = `merge-canonical-${suffix}`;
    const retiredSubjectId = `merge-retired-${suffix}`;

    await db.insert(shopParty).values({
      displayName: `Canonical ${suffix}`,
      kind: "person",
      identitySubjectId: canonicalSubjectId,
    });
    await db.insert(shopParty).values({
      displayName: `Retired ${suffix}`,
      kind: "person",
      identitySubjectId: retiredSubjectId,
    });

    const mergedAt = new Date().toISOString();
    const [event] = await db
      .insert(domainEvent)
      .values({
        aggregateType: "user",
        aggregateId: canonicalSubjectId,
        eventType: "user.identity_merged",
        payload: {
          schemaVersion: 1,
          subjectId: canonicalSubjectId,
          retiredSubjectId,
          mergedAt,
        },
        schemaVersion: 1,
        producer: "identity-api",
        occurredAt: new Date(),
      })
      .returning({ id: domainEvent.id });

    const eventId = requireDefined(event?.id, "event id");
    await runMerge();

    const [inboxRow] = await db
      .select({ status: shopIdentityMergeInbox.status })
      .from(shopIdentityMergeInbox)
      .where(eq(shopIdentityMergeInbox.eventId, eventId))
      .limit(1);
    expect(inboxRow?.status).toBe("dead");
  });
});
