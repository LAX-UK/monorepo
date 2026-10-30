import {
  domainEvent,
  shopGuestCustomer,
  shopOrder,
  shopParty,
  shopProjectionCursor,
} from "@auction/db/schema";
import { GUEST_MARKETING_CONSENT, guestOrderSubject } from "@auction/shop-domain";
import { and, eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  completeFixtureOrderPayment,
  createPendingPaymentOrderWithReservedEdition,
  grantLaxSaleAuthority,
  importTestArtwork,
  integrationSuffix,
} from "../../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../../test-support/shop-integration-setup.js";
import { createDrizzleOrderRepository } from "../drizzle-order.repository.js";
import { createClaimGuestOrdersRunner } from "../scheduler/claim-guest-orders.runner.js";
import { createDrizzleGuestCustomerStore } from "./drizzle-guest-customer.store.js";
import { createDrizzleGuestOrderClaimer } from "./drizzle-guest-order-claimer.js";
import { createDrizzleGuestOrderLinks } from "./drizzle-guest-order-links.js";

describe.skipIf(!hasShopIntegrationDb)("guest checkout persistence", () => {
  let ownerPool: pg.Pool;
  let shopPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await ownerPool.end();
    await shopPool.end();
  });

  async function guestOrder(label: string) {
    const db = createShopDb(shopPool);
    const suffix = integrationSuffix(label);
    const email = `guest-${suffix}@example.com`;
    const store = createDrizzleGuestCustomerStore(db, { domainEventMode: "off" });
    const { guestCustomerId } = await store.record(
      { email, name: "Ada Lovelace", marketingConsent: false },
      new Date(),
    );
    const artwork = await importTestArtwork(db, label, { printPricePence: 8_500 });
    await grantLaxSaleAuthority(db, artwork.artworkId, 1);
    const fixture = await createPendingPaymentOrderWithReservedEdition(db, {
      artworkId: artwork.artworkId,
      suffix,
      totalPence: 8_500,
      identitySubjectId: guestOrderSubject(guestCustomerId),
    });
    await db.update(shopOrder).set({ guestCustomerId }).where(eq(shopOrder.id, fixture.orderId));
    return { db, email, guestCustomerId, fixture, store };
  }

  it("keeps one lead per email and records consent with the wording's version", async () => {
    const { db, email, guestCustomerId, store } = await guestOrder("guest-lead");
    const again = await store.record(
      { email, marketingConsent: true, phone: "07700 900123" },
      new Date(),
    );
    expect(again.guestCustomerId).toBe(guestCustomerId);
    const [row] = await db
      .select()
      .from(shopGuestCustomer)
      .where(eq(shopGuestCustomer.id, guestCustomerId));
    expect(row).toMatchObject({
      name: "Ada Lovelace",
      phone: "07700 900123",
      marketingConsent: true,
      marketingConsentVersion: GUEST_MARKETING_CONSENT.version,
      paidOrderCount: 0,
    });
    expect(row?.marketingConsentAt).toBeInstanceOf(Date);
  });

  it("opens a guest order from its link until the order is claimed by a verified account", async () => {
    const { db, email, guestCustomerId, fixture } = await guestOrder("guest-claim");
    await completeFixtureOrderPayment(db, fixture, `evt_${fixture.orderId}`);
    const [paid] = await db
      .select({ count: shopGuestCustomer.paidOrderCount })
      .from(shopGuestCustomer)
      .where(eq(shopGuestCustomer.id, guestCustomerId));
    expect(paid?.count).toBe(1);

    const links = createDrizzleGuestOrderLinks(db, {
      orders: createDrizzleOrderRepository(db),
      notifications: { queueGuestOrderLink: async () => undefined },
      paymentGateway: {} as never,
      storefrontUrl: "http://localhost:3020",
    });
    const { token } = await links.issue(fixture.orderId, new Date());
    const opened = await links.resolve(token, new Date());
    expect(opened.kind).toBe("valid");
    expect(await links.resolve("x".repeat(43), new Date())).toEqual({ kind: "not_found" });
    const later = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
    expect((await links.resolve(token, later)).kind).toBe("expired");

    const subjectId = `account-${fixture.orderId}`;
    const claimer = createDrizzleGuestOrderClaimer(db, { domainEventMode: "off" });
    expect(await claimer.claimForVerifiedEmail({ subjectId, email: email.toUpperCase() })).toEqual({
      claimedOrders: 1,
    });
    const claimed = await createDrizzleOrderRepository(db).getOrder(subjectId, fixture.orderId);
    expect(claimed?.orderId).toBe(fixture.orderId);
    const [party] = await db
      .select({ subject: shopParty.identitySubjectId })
      .from(shopParty)
      .innerJoin(shopOrder, eq(shopOrder.buyerPartyId, shopParty.id))
      .where(eq(shopOrder.id, fixture.orderId));
    expect(party?.subject).toBe(subjectId);
    expect((await links.resolve(token, new Date())).kind).toBe("claimed");
    // A second claim finds nothing left to move.
    expect(await claimer.claimForVerifiedEmail({ subjectId, email })).toEqual({
      claimedOrders: 0,
    });
  });

  it("claims from Identity's email-verified events and moves its cursor past them", async () => {
    const { db, email, fixture } = await guestOrder("guest-event");
    const subjectId = `account-event-${fixture.orderId}`;
    const ownerDb = createShopDb(ownerPool);
    await ownerDb.insert(domainEvent).values({
      aggregateType: "user",
      aggregateId: subjectId,
      eventType: "user.email_verified",
      payload: { userId: subjectId, email, verifiedAt: new Date().toISOString() },
      producer: "apps/auth",
    });
    const run = createClaimGuestOrdersRunner(
      db,
      createDrizzleGuestOrderClaimer(db, { domainEventMode: "off" }),
    );
    // The shared log can hold many earlier events; read until this one has been seen.
    for (let i = 0; i < 200; i++) {
      const { processed } = await run();
      if (processed === 0) break;
    }
    const [order] = await db
      .select({ subject: shopOrder.identitySubjectId })
      .from(shopOrder)
      .where(eq(shopOrder.id, fixture.orderId));
    expect(order?.subject).toBe(subjectId);
    const [cursor] = await db
      .select({ last: shopProjectionCursor.lastEventId })
      .from(shopProjectionCursor)
      .where(and(eq(shopProjectionCursor.name, "shop_guest_order_claim")));
    expect(cursor?.last).toBeGreaterThan(0);
  });
});
