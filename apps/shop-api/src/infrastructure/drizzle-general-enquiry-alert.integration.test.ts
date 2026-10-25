import crypto from "node:crypto";
import { emailOutbox, shopGeneralEnquiry } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleEditorialRepository } from "./drizzle-editorial.repository.js";
import { createDrizzleShopNotificationPublisher } from "./drizzle-shop-notification.publisher.js";

describe.skipIf(!hasShopIntegrationDb)("general enquiry staff alert", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  it("queues a lax.art alert with the guest contact in the same transaction as the enquiry", async () => {
    const db = createShopDb(shopPool);
    const repo = createDrizzleEditorialRepository(db, {
      resolveMediaUrl: (value) => value ?? null,
      generalEnquiryAlerts: {
        notifications: createDrizzleShopNotificationPublisher(),
        opsEmail: "gallery-ops@example.test",
      },
    });
    const subject = `it-general-enquiry-${crypto.randomUUID()}`;

    const { enquiryId } = await repo.insertGeneralEnquiry({
      sender: {
        kind: "guest",
        contactName: "Grace Hopper",
        contactEmail: `${subject}@example.com`,
      },
      topic: "private_viewing",
      contextSlug: "lax-marylebone",
      message: "Could I visit on Saturday?",
      phone: null,
    });

    const [alert] = await db
      .select({
        template: emailOutbox.template,
        to: emailOutbox.toSnapshot,
        vars: emailOutbox.vars,
      })
      .from(emailOutbox)
      .where(eq(emailOutbox.idempotencyKey, `general-enquiry:${enquiryId}`));
    expect(alert).toMatchObject({
      template: "art-general-enquiry-alert",
      to: "gallery-ops@example.test",
      vars: {
        topicLabel: "Private viewing",
        buyerEmail: `${subject}@example.com`,
        buyerName: "Grace Hopper",
        guest: true,
        contextSlug: "lax-marylebone",
        message: "Could I visit on Saturday?",
      },
    });

    const ownerDb = createShopDb(ownerPool);
    await ownerDb
      .delete(emailOutbox)
      .where(eq(emailOutbox.idempotencyKey, `general-enquiry:${enquiryId}`));
    await ownerDb.delete(shopGeneralEnquiry).where(eq(shopGeneralEnquiry.id, enquiryId));
  });
});
