import type { Database } from "@auction/db";
import {
  domainEvent,
  emailOutbox,
  shopAdminAudit,
  shopArtworkInterest,
  shopEdition,
  shopFulfilment,
  shopOrder,
  shopOrderLine,
  shopPayoutLedger,
  shopRefund,
  shopReturn,
  shopSaleAuthorityGrant,
} from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import type { ShopFulfilmentStatus } from "@auction/shop-domain";
import { and, eq } from "drizzle-orm";
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
import { createDrizzleShopNotificationPublisher } from "./drizzle-shop-notification.publisher.js";
import { createDrizzleShopUnitOfWork } from "./drizzle-shop-transaction-effects.js";
import { createAdvanceReturnHandler } from "./handlers/admin/advance-return.handler.js";
import { createCancelAfterPossessionHandler } from "./handlers/admin/cancel-after-possession.handler.js";
import { createMarkRefundSettledOutsideHandler } from "./handlers/admin/mark-refund-settled-outside.handler.js";
import { createRetryRefundHandler } from "./handlers/admin/retry-refund.handler.js";
import { completeRefundFromWebhook } from "./handlers/webhooks/complete-refund.handler.js";
import { createSubmitPendingRefundsRunner } from "./scheduler/submit-pending-refunds.runner.js";
import { dispatchShopNotifyMeEmails } from "./shop-notify-me-dispatch.js";

const ITEM_PENCE = 4_000;
const ORIGINS = { shop: "http://localhost:3020", art: "http://localhost:3050" };

describe.skipIf(!hasShopIntegrationDb)("shop returns and stock integration", () => {
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

  const uow = () => createDrizzleShopUnitOfWork(db, "off");
  const actor = "operations-returns-subject";

  /** A paid one-print order inside its cancellation period, with the item at `fulfilment`. */
  async function paidOrder(label: string, fulfilment: ShopFulfilmentStatus) {
    const suffix = integrationSuffix(label);
    const imported = await importTestArtwork(db, label, { printPricePence: ITEM_PENCE });
    await grantLaxSaleAuthority(db, imported.artworkId, 1);
    const pending = await createPendingPaymentOrderWithReservedEdition(db, {
      artworkId: imported.artworkId,
      suffix,
      totalPence: ITEM_PENCE,
    });
    await completeFixtureOrderPayment(db, pending, `evt-${suffix}`);
    await db
      .update(shopOrder)
      .set({
        stripePaymentIntentId: `pi_${suffix}`,
        refundPeriodEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .where(eq(shopOrder.id, pending.orderId));
    await db
      .update(shopFulfilment)
      .set({ status: fulfilment })
      .where(eq(shopFulfilment.orderId, pending.orderId));
    const [line] = await db
      .select({ id: shopOrderLine.id })
      .from(shopOrderLine)
      .where(eq(shopOrderLine.orderId, pending.orderId));
    const orderLineId = requireDefined(line?.id, "order line");
    await db.insert(shopPayoutLedger).values({
      orderLineId,
      ownerPartyId: pending.sellerPartyId,
      grossPence: ITEM_PENCE,
      netPence: ITEM_PENCE,
      payoutDueAt: new Date(),
      status: "due",
      source: "order_line",
    });
    return {
      suffix,
      artworkId: imported.artworkId,
      slug: imported.slug,
      orderId: pending.orderId,
      editionId: pending.editionId,
      sellerPartyId: pending.sellerPartyId,
      orderLineId,
    };
  }
  type PaidOrder = Awaited<ReturnType<typeof paidOrder>>;

  async function cancel(order: PaidOrder) {
    return createCancelAfterPossessionHandler({ uow: uow() })({
      orderLineId: order.orderLineId,
      editionId: order.editionId,
      actorSubjectId: actor,
      idempotencyKey: `cancel-${order.suffix}`,
    });
  }

  async function edition(id: string) {
    const [row] = await db.select().from(shopEdition).where(eq(shopEdition.id, id));
    return requireDefined(row, "edition");
  }

  async function releasedEvents(editionId: string) {
    return db
      .select()
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.aggregateId, editionId),
          eq(domainEvent.eventType, "shop.edition.released"),
        ),
      );
  }

  async function auditActions(targetId: string) {
    const rows = await db
      .select({ action: shopAdminAudit.action })
      .from(shopAdminAudit)
      .where(eq(shopAdminAudit.targetId, targetId));
    return rows.map((row) => row.action).sort();
  }

  async function expectRefused(promise: Promise<unknown>, code: string) {
    const error = await promise.then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ShopApiError);
    expect((error as ShopApiError).code).toBe(code);
  }

  describe("an item that never left the gallery", () => {
    it("goes back on sale at once when cancelled, with no return to track", async () => {
      const order = await paidOrder("stock-in-gallery", "in_storage");
      expect((await edition(order.editionId)).listingStatus).toBe("sold");

      const result = await cancel(order);
      expect(result).toMatchObject({ returnId: null, status: "restocked" });

      const back = await edition(order.editionId);
      expect(back).toMatchObject({
        listingStatus: "authorised",
        ownerPartyId: order.sellerPartyId,
        custodyStatus: "stored",
        reservedByOrderId: null,
      });
      expect(
        await db.select().from(shopReturn).where(eq(shopReturn.editionId, order.editionId)),
      ).toHaveLength(0);
      expect(await releasedEvents(order.editionId)).toHaveLength(1);
      expect(await auditActions(order.editionId)).toContain("edition_back_on_sale");
      const [cancelledLine] = await db
        .select({ releasedAt: shopOrderLine.releasedAt })
        .from(shopOrderLine)
        .where(eq(shopOrderLine.id, order.orderLineId));
      expect(cancelledLine?.releasedAt).toBeInstanceOf(Date);
    });

    it("keeps the print's own number when it goes back on sale", async () => {
      const order = await paidOrder("stock-number", "awaiting_dispatch");
      const before = await edition(order.editionId);
      await cancel(order);
      const after = await edition(order.editionId);
      expect(after.editionNumber).toBe(before.editionNumber);
      expect(after.stockRef).toBe(before.stockRef);
    });

    it("emails people waiting for the edition once it is back", async () => {
      const order = await paidOrder("stock-notify", "in_storage");
      const [interest] = await db
        .insert(shopArtworkInterest)
        .values({
          artworkId: order.artworkId,
          intent: "notify_me",
          contactEmail: `waiting-${order.suffix}@example.com`,
        })
        .returning({ id: shopArtworkInterest.id });
      const interestId = requireDefined(interest?.id, "interest");
      const notifications = createDrizzleShopNotificationPublisher();
      const dispatch = () =>
        dispatchShopNotifyMeEmails(db, {
          notifications,
          storefrontOrigins: ORIGINS,
          now: new Date(),
        });
      await dispatch();
      const emailsFor = () =>
        db
          .select({ id: emailOutbox.id })
          .from(emailOutbox)
          .where(eq(emailOutbox.idempotencyKey, `edition-available:${interestId}`));
      expect(await emailsFor()).toHaveLength(0);

      await cancel(order);
      await dispatch();
      expect(await emailsFor()).toHaveLength(1);
    });

    it("is not put back on sale beyond the sale authority that still stands", async () => {
      const order = await paidOrder("stock-authority", "in_storage");
      // Sale authority was withdrawn while the print was sold: the grant now covers nothing.
      await db.insert(shopSaleAuthorityGrant).values({
        artworkId: order.artworkId,
        ownerPartyId: order.sellerPartyId,
        authorisedCount: 0,
        recordedBySubjectId: actor,
        evidenceNote: "Authority withdrawn while the print was sold",
      });
      await cancel(order);
      const back = await edition(order.editionId);
      expect(back).toMatchObject({
        listingStatus: "not_authorised",
        ownerPartyId: order.sellerPartyId,
        custodyStatus: "stored",
      });
      expect(await releasedEvents(order.editionId)).toHaveLength(0);
    });
  });

  describe("an item that was dispatched", () => {
    it("opens a return and leaves the edition sold until it is received", async () => {
      const order = await paidOrder("stock-dispatched", "delivered");
      const result = await cancel(order);
      expect(result.status).toBe("requested");
      const returnId = requireDefined(result.returnId, "return id");
      const [row] = await db.select().from(shopReturn).where(eq(shopReturn.id, returnId));
      expect(row).toMatchObject({ status: "requested", disposition: null, receivedAt: null });
      expect((await edition(order.editionId)).listingStatus).toBe("sold");
      expect(await releasedEvents(order.editionId)).toHaveLength(0);
    });

    it("moves requested to in transit to received, one step at a time", async () => {
      const order = await paidOrder("return-steps", "delivered");
      const returnId = requireDefined((await cancel(order)).returnId, "return id");
      const advance = createAdvanceReturnHandler({ uow: uow() });

      await expectRefused(
        advance({
          returnId,
          to: "received",
          disposition: "back_on_sale",
          actorSubjectId: actor,
          idempotencyKey: `skip-${order.suffix}`,
        }),
        SHOP_API_ERROR_CODES.CONFLICT,
      );

      const transit = await advance({
        returnId,
        to: "in_transit",
        actorSubjectId: actor,
        idempotencyKey: `transit-${order.suffix}`,
      });
      expect(transit.status).toBe("in_transit");
      expect((await edition(order.editionId)).listingStatus).toBe("sold");

      await expectRefused(
        advance({
          returnId,
          to: "in_transit",
          actorSubjectId: actor,
          idempotencyKey: `transit-again-${order.suffix}`,
        }),
        SHOP_API_ERROR_CODES.CONFLICT,
      );
      expect(await auditActions(returnId)).toEqual(
        expect.arrayContaining(["cancel_after_possession", "return_in_transit"]),
      );
    });

    it("puts the print back on sale on receipt, and tells people waiting for it", async () => {
      const order = await paidOrder("return-back-on-sale", "collected");
      const returnId = requireDefined((await cancel(order)).returnId, "return id");
      const advance = createAdvanceReturnHandler({ uow: uow() });
      await advance({
        returnId,
        to: "in_transit",
        actorSubjectId: actor,
        idempotencyKey: `t-${order.suffix}`,
      });
      const key = `received-${order.suffix}`;
      const received = await advance({
        returnId,
        to: "received",
        disposition: "back_on_sale",
        actorSubjectId: actor,
        idempotencyKey: key,
      });
      expect(received).toMatchObject({ status: "received", onSale: true });
      // The same request sent again changes nothing more.
      expect(
        await advance({
          returnId,
          to: "received",
          disposition: "back_on_sale",
          actorSubjectId: actor,
          idempotencyKey: key,
        }),
      ).toEqual(received);

      expect(await edition(order.editionId)).toMatchObject({
        listingStatus: "authorised",
        ownerPartyId: order.sellerPartyId,
        custodyStatus: "stored",
      });
      const [row] = await db.select().from(shopReturn).where(eq(shopReturn.id, returnId));
      expect(row).toMatchObject({ status: "received", disposition: "back_on_sale" });
      expect(row?.receivedAt).toBeInstanceOf(Date);
      expect(await releasedEvents(order.editionId)).toHaveLength(1);
      expect(await auditActions(returnId)).toContain("return_received");
    });

    it("withdraws a print that comes back damaged, without a release event", async () => {
      const order = await paidOrder("return-damaged", "delivered");
      const returnId = requireDefined((await cancel(order)).returnId, "return id");
      const advance = createAdvanceReturnHandler({ uow: uow() });
      await advance({
        returnId,
        to: "in_transit",
        actorSubjectId: actor,
        idempotencyKey: `t-${order.suffix}`,
      });
      const received = await advance({
        returnId,
        to: "received",
        disposition: "withdrawn_damaged",
        actorSubjectId: actor,
        idempotencyKey: `received-${order.suffix}`,
      });
      expect(received).toMatchObject({ status: "received", onSale: false });
      expect(await edition(order.editionId)).toMatchObject({
        listingStatus: "withdrawn",
        ownerPartyId: order.sellerPartyId,
        custodyStatus: "returned",
        withdrawnReason: "Returned damaged",
      });
      expect(await releasedEvents(order.editionId)).toHaveLength(0);
    });

    it("needs a decision on receipt and refuses one before it", async () => {
      const order = await paidOrder("return-decision", "delivered");
      const returnId = requireDefined((await cancel(order)).returnId, "return id");
      const advance = createAdvanceReturnHandler({ uow: uow() });
      await expectRefused(
        advance({
          returnId,
          to: "received",
          actorSubjectId: actor,
          idempotencyKey: `n-${order.suffix}`,
        }),
        SHOP_API_ERROR_CODES.VALIDATION,
      );
      await expectRefused(
        advance({
          returnId,
          to: "in_transit",
          disposition: "back_on_sale",
          actorSubjectId: actor,
          idempotencyKey: `e-${order.suffix}`,
        }),
        SHOP_API_ERROR_CODES.VALIDATION,
      );
    });

    it("refuses to restock a print that now belongs to someone else", async () => {
      const order = await paidOrder("return-resold", "delivered");
      const returnId = requireDefined((await cancel(order)).returnId, "return id");
      const advance = createAdvanceReturnHandler({ uow: uow() });
      await advance({
        returnId,
        to: "in_transit",
        actorSubjectId: actor,
        idempotencyKey: `t-${order.suffix}`,
      });
      await db
        .update(shopEdition)
        .set({ ownerPartyId: order.sellerPartyId })
        .where(eq(shopEdition.id, order.editionId));
      await expectRefused(
        advance({
          returnId,
          to: "received",
          disposition: "back_on_sale",
          actorSubjectId: actor,
          idempotencyKey: `r-${order.suffix}`,
        }),
        SHOP_API_ERROR_CODES.CONFLICT,
      );
      const [row] = await db.select().from(shopReturn).where(eq(shopReturn.id, returnId));
      expect(row?.status).toBe("in_transit");
    });

    it("refuses to restock a print another checkout has open", async () => {
      const order = await paidOrder("return-open-checkout", "delivered");
      const returnId = requireDefined((await cancel(order)).returnId, "return id");
      const advance = createAdvanceReturnHandler({ uow: uow() });
      await advance({
        returnId,
        to: "in_transit",
        actorSubjectId: actor,
        idempotencyKey: `t-${order.suffix}`,
      });
      const [other] = await db
        .insert(shopOrder)
        .values({
          identitySubjectId: `other-${order.suffix}`,
          fulfilment: "collect_brunswick",
          merchandiseSubtotalPence: ITEM_PENCE,
          fulfilmentSurchargePence: 0,
          totalPence: ITEM_PENCE,
          idempotencyKey: `idem-other-${order.suffix}`,
          status: "pending_payment",
        })
        .returning({ id: shopOrder.id });
      // Written directly: the checkout itself could not start while the print was still sold.
      await db
        .update(shopOrderLine)
        .set({ releasedAt: new Date() })
        .where(eq(shopOrderLine.id, order.orderLineId));
      await db.insert(shopOrderLine).values({
        orderId: requireDefined(other?.id, "other order"),
        editionId: order.editionId,
        artworkId: order.artworkId,
        sellerPartyId: order.sellerPartyId,
        unitPricePence: ITEM_PENCE,
      });
      await expectRefused(
        advance({
          returnId,
          to: "received",
          disposition: "back_on_sale",
          actorSubjectId: actor,
          idempotencyKey: `r-${order.suffix}`,
        }),
        SHOP_API_ERROR_CODES.CONFLICT,
      );
      expect((await edition(order.editionId)).listingStatus).toBe("sold");
    });
  });

  describe("a refund on its own", () => {
    it("never changes stock, even when it refunds the whole order", async () => {
      const order = await paidOrder("refund-stock", "delivered");
      const before = await edition(order.editionId);
      await db.insert(shopRefund).values({
        orderId: order.orderId,
        orderLineId: order.orderLineId,
        amountPence: ITEM_PENCE,
        idempotencyKey: `goodwill-${order.suffix}`,
        requestedBySubjectId: actor,
        stripeRefundId: `re_${order.suffix}`,
      });
      await completeRefundFromWebhook(
        db,
        {
          eventId: `evt-refund-${order.suffix}`,
          stripeRefundId: `re_${order.suffix}`,
          paymentIntentId: `pi_${order.suffix}`,
          amountPence: ITEM_PENCE,
          status: "succeeded",
          source: "refund.updated",
        },
        "off",
      );
      const [orderRow] = await db.select().from(shopOrder).where(eq(shopOrder.id, order.orderId));
      expect(orderRow?.status).toBe("refunded");
      const after = await edition(order.editionId);
      expect(after.listingStatus).toBe(before.listingStatus);
      expect(after.ownerPartyId).toBe(before.ownerPartyId);
      expect(after.custodyStatus).toBe(before.custodyStatus);
      expect(await releasedEvents(order.editionId)).toHaveLength(0);
    });
  });

  describe("marking a failed refund as refunded outside LAX", () => {
    async function failedCancellationRefund(label: string) {
      const order = await paidOrder(label, "delivered");
      const result = await cancel(order);
      await createSubmitPendingRefundsRunner(db, {
        async submitRefund() {
          return { ok: false, retryable: false, message: "charge_already_refunded" };
        },
      })();
      return { order, refundId: result.refundId };
    }

    const settle = (refundId: string, key: string, over: Record<string, string> = {}) =>
      createMarkRefundSettledOutsideHandler({ uow: uow() })({
        refundId,
        reason: "Refunded from the Stripe dashboard after the API call failed",
        externalReference: "re_3Qdashboard",
        actorSubjectId: "finance-subject",
        idempotencyKey: key,
        ...over,
      });

    it("counts the refund as paid, settles the order and the artist's payout, and is audited", async () => {
      const { order, refundId } = await failedCancellationRefund("outside-ok");
      const [held] = await db
        .select({ blockedReason: shopPayoutLedger.blockedReason })
        .from(shopPayoutLedger)
        .where(eq(shopPayoutLedger.orderLineId, order.orderLineId));
      expect(held?.blockedReason).toBe("cancellation");

      const key = `outside-${order.suffix}`;
      const result = await settle(refundId, key);
      expect(result).toEqual({ refundId, status: "succeeded" });
      expect(await settle(refundId, key)).toEqual(result);

      const [refund] = await db.select().from(shopRefund).where(eq(shopRefund.id, refundId));
      expect(refund).toMatchObject({
        status: "succeeded",
        lastError: null,
        settledOutsideReference: "re_3Qdashboard",
        settledOutsideBySubjectId: "finance-subject",
      });
      expect(refund?.settledOutsideAt).toBeInstanceOf(Date);
      const [orderRow] = await db.select().from(shopOrder).where(eq(shopOrder.id, order.orderId));
      expect(orderRow?.status).toBe("refunded");
      const [payout] = await db
        .select({ status: shopPayoutLedger.status, blockedReason: shopPayoutLedger.blockedReason })
        .from(shopPayoutLedger)
        .where(eq(shopPayoutLedger.orderLineId, order.orderLineId));
      expect(payout).toMatchObject({ status: "cancelled", blockedReason: "refund" });

      const audits = await db
        .select()
        .from(shopAdminAudit)
        .where(
          and(
            eq(shopAdminAudit.targetId, refundId),
            eq(shopAdminAudit.action, "refund_settled_outside"),
          ),
        );
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        actorSubjectId: "finance-subject",
        capability: "refund.write",
      });
      expect(JSON.parse(String(audits[0]?.afterJson))).toMatchObject({
        reference: "re_3Qdashboard",
        amountPence: ITEM_PENCE,
      });
      // The money being settled says nothing about the print: that waits for its return.
      expect((await edition(order.editionId)).listingStatus).toBe("sold");
    });

    it("needs a reason and the reference of the outside refund", async () => {
      const { order, refundId } = await failedCancellationRefund("outside-fields");
      await expectRefused(
        settle(refundId, `r-${order.suffix}`, { reason: "   " }),
        SHOP_API_ERROR_CODES.VALIDATION,
      );
      await expectRefused(
        settle(refundId, `e-${order.suffix}`, { externalReference: "" }),
        SHOP_API_ERROR_CODES.VALIDATION,
      );
      const [refund] = await db.select().from(shopRefund).where(eq(shopRefund.id, refundId));
      expect(refund?.status).toBe("failed");
    });

    it("is refused for a refund that is pending", async () => {
      const order = await paidOrder("outside-pending", "delivered");
      const { refundId } = await cancel(order);
      await expectRefused(settle(refundId, `p-${order.suffix}`), SHOP_API_ERROR_CODES.CONFLICT);
    });

    it("is refused for a refund that already succeeded", async () => {
      const { order, refundId } = await failedCancellationRefund("outside-succeeded");
      await settle(refundId, `first-${order.suffix}`);
      await expectRefused(
        settle(refundId, `second-${order.suffix}`),
        SHOP_API_ERROR_CODES.CONFLICT,
      );
    });

    it("is refused once another refund already covers the money", async () => {
      const { order, refundId } = await failedCancellationRefund("outside-covered");
      await db.insert(shopRefund).values({
        orderId: order.orderId,
        orderLineId: order.orderLineId,
        amountPence: ITEM_PENCE,
        idempotencyKey: `manual-${order.suffix}`,
        requestedBySubjectId: actor,
        source: "admin",
      });
      await expectRefused(settle(refundId, `c-${order.suffix}`), SHOP_API_ERROR_CODES.CONFLICT);
      const [refund] = await db.select().from(shopRefund).where(eq(shopRefund.id, refundId));
      expect(refund?.status).toBe("failed");
    });

    it("leaves a retried refund alone once it is settled", async () => {
      const { order, refundId } = await failedCancellationRefund("outside-then-retry");
      await settle(refundId, `s-${order.suffix}`);
      await expectRefused(
        createRetryRefundHandler({ uow: uow() })({
          refundId,
          actorSubjectId: actor,
          idempotencyKey: `retry-${order.suffix}`,
        }),
        SHOP_API_ERROR_CODES.CONFLICT,
      );
    });
  });
});
