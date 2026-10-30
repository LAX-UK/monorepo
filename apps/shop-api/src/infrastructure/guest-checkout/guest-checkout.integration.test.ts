import {
  domainEvent,
  emailOutbox,
  shopAdminAudit,
  shopGeneralEnquiry,
  shopGuestCustomer,
  shopOrder,
  shopParty,
  shopProjectionCursor,
} from "@auction/db/schema";
import { GUEST_MARKETING_CONSENT, guestOrderSubject } from "@auction/shop-domain";
import { and, eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GuestErasureService } from "../../application/guest-erasure/guest-erasure.service.js";
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
import { createDrizzleShopNotificationPublisher } from "../drizzle-shop-notification.publisher.js";
import { createEnquiryFollowUp } from "../enquiry-follow-up.js";
import { createClaimGuestOrdersRunner } from "../scheduler/claim-guest-orders.runner.js";
import { createPurgeRetainedInvoiceDataRunner } from "../scheduler/purge-retained-invoice-data.runner.js";
import { createDrizzleGuestCustomerStore } from "./drizzle-guest-customer.store.js";
import { createDrizzleGuestErasureStore } from "./drizzle-guest-erasure.store.js";
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
      claimedEnquiries: 0,
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
      claimedEnquiries: 0,
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

  it("claims a guest's orders and enquiries when an account confirms a change to that email", async () => {
    const { db, email, fixture } = await guestOrder("guest-email-change");
    const [enquiry] = await db
      .insert(shopGeneralEnquiry)
      .values({ topic: "general", message: "Do you frame prints?", contactEmail: email })
      .returning({ id: shopGeneralEnquiry.id, reference: shopGeneralEnquiry.reference });
    expect(enquiry?.reference).toMatch(/^E-\d+$/);
    const subjectId = `account-change-${fixture.orderId}`;
    await createShopDb(ownerPool)
      .insert(domainEvent)
      .values({
        aggregateType: "user",
        aggregateId: subjectId,
        eventType: "user.profile_updated",
        payload: {
          schemaVersion: 1,
          subjectId,
          email,
          emailVerified: true,
          updatedAt: new Date().toISOString(),
        },
        producer: "apps/auth",
      });
    const run = createClaimGuestOrdersRunner(
      db,
      createDrizzleGuestOrderClaimer(db, { domainEventMode: "off" }),
    );
    for (let i = 0; i < 200; i++) {
      const { processed } = await run();
      if (processed === 0) break;
    }
    const [order] = await db
      .select({ subject: shopOrder.identitySubjectId })
      .from(shopOrder)
      .where(eq(shopOrder.id, fixture.orderId));
    expect(order?.subject).toBe(subjectId);
    const [claimedEnquiry] = await db
      .select({ subject: shopGeneralEnquiry.identitySubjectId })
      .from(shopGeneralEnquiry)
      .where(eq(shopGeneralEnquiry.id, enquiry?.id ?? ""));
    expect(claimedEnquiry?.subject).toBe(subjectId);
  });

  it("erases a guest's personal data and keeps the order for the accounting record", async () => {
    const { db, email, guestCustomerId, fixture } = await guestOrder("guest-erase");
    await db
      .update(shopOrder)
      .set({ deliveryRecipientName: "Ada Lovelace", deliveryLine1: "1 Example Street" })
      .where(eq(shopOrder.id, fixture.orderId));
    await db
      .insert(shopGeneralEnquiry)
      .values({ topic: "art_advisory", message: "My flat is in Hackney.", contactEmail: email });
    const links = createDrizzleGuestOrderLinks(db, {
      orders: createDrizzleOrderRepository(db),
      notifications: { queueGuestOrderLink: async () => undefined },
      paymentGateway: {} as never,
      storefrontUrl: "http://localhost:3020",
    });
    const { token } = await links.issue(fixture.orderId, new Date());
    const service = new GuestErasureService(
      createDrizzleGuestErasureStore(db, { domainEventMode: "off" }),
    );
    const request = {
      guestCustomerId,
      confirmation: email,
      reason: "Asked by email to delete their data.",
      actorSubjectId: "staff-erase",
    };

    // An unpaid checkout is still open, so it is finished first.
    expect(await service.erase(request)).toMatchObject({ kind: "blocked", reason: "open_order" });
    await db.update(shopOrder).set({ status: "expired" }).where(eq(shopOrder.id, fixture.orderId));

    expect(await service.erase(request)).toMatchObject({
      kind: "erased",
      orders: 1,
      enquiries: 1,
      links: 1,
    });
    const [order] = await db.select().from(shopOrder).where(eq(shopOrder.id, fixture.orderId));
    // The invoice name and address stay for the accounting record; the phone goes.
    expect(order).toMatchObject({
      deliveryRecipientName: "Ada Lovelace",
      deliveryLine1: "1 Example Street",
      deliveryPhone: null,
      totalPence: 8_500,
    });
    expect(order?.personalDataErasedAt).toBeInstanceOf(Date);

    // Six years after the financial year ends, the scheduled purge clears them.
    const purge = createPurgeRetainedInvoiceDataRunner(db);
    expect(await purge(new Date())).toEqual({ purged: 0 });
    await db
      .update(shopOrder)
      .set({ createdAt: new Date("2018-05-01T10:00:00Z"), paidAt: null })
      .where(eq(shopOrder.id, fixture.orderId));
    await purge(new Date());
    const [purged] = await db.select().from(shopOrder).where(eq(shopOrder.id, fixture.orderId));
    expect(purged).toMatchObject({ deliveryRecipientName: null, deliveryLine1: null });
    expect(purged?.invoiceDataPurgedAt).toBeInstanceOf(Date);
    const [lead] = await db
      .select()
      .from(shopGuestCustomer)
      .where(eq(shopGuestCustomer.id, guestCustomerId));
    expect(lead).toMatchObject({ email: `erased:${guestCustomerId}`, name: null, phone: null });
    expect(lead?.erasedBySubjectId).toBe("staff-erase");
    const leftover = await db
      .select({ id: shopGeneralEnquiry.id })
      .from(shopGeneralEnquiry)
      .where(eq(shopGeneralEnquiry.contactEmail, email));
    expect(leftover).toHaveLength(0);
    expect(await links.resolve(token, new Date())).toEqual({ kind: "not_found" });
    const audit = await db
      .select({ afterJson: shopAdminAudit.afterJson })
      .from(shopAdminAudit)
      .where(eq(shopAdminAudit.targetId, guestCustomerId));
    expect(audit[0]?.afterJson).not.toContain(email);
    expect(await service.erase(request)).toMatchObject({
      kind: "blocked",
      reason: "already_erased",
    });
  });

  it("makes a guest enquiry a lead and emails the sender their copy", async () => {
    const db = createShopDb(shopPool);
    const email = `enquirer-${integrationSuffix("lead")}@example.com`;
    const followUp = createEnquiryFollowUp({
      notifications: createDrizzleShopNotificationPublisher(),
      domainEventMode: "off",
    });
    const reference = `E-9${Date.now().toString().slice(-7)}`;
    const enquiry = {
      reference,
      sender: { kind: "guest" as const, contactName: "Ana Collector", contactEmail: email },
      phone: null,
      salesChannel: "art" as const,
      topic: "private_viewing" as const,
    };
    await db.transaction((tx) => followUp.afterStored(tx, enquiry, new Date()));
    await db.transaction((tx) =>
      followUp.afterStored(tx, { ...enquiry, reference: `${reference}1` }, new Date()),
    );
    const [lead] = await db
      .select()
      .from(shopGuestCustomer)
      .where(eq(shopGuestCustomer.email, email));
    expect(lead).toMatchObject({
      source: "art_enquiry",
      enquiryCount: 2,
      checkoutStartedAt: null,
      name: "Ana Collector",
    });
    const [copy] = await db
      .select({ template: emailOutbox.template, to: emailOutbox.toSnapshot })
      .from(emailOutbox)
      .where(eq(emailOutbox.idempotencyKey, `enquiry-received:${reference}`));
    expect(copy).toEqual({ template: "art-enquiry-received", to: email });
  });
});
