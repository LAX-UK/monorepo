import { createHash } from "node:crypto";
import { assembleDigest } from "@auction/alerts";
import { describeAlertStoreContract } from "@auction/alerts/testing";
import { emailOutbox, shopAlertSubscriber } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../../test-support/shop-integration-setup.js";
import {
  ShopAlertAnnouncementStore,
  ShopAlertDigestLedger,
  ShopAlertMatchLedger,
} from "./shop-alert-ledgers.js";
import { ShopAlertMailer } from "./shop-alert-mailer.js";
import { ShopAlertSubscriberStore } from "./shop-alert-subscriber.store.js";
import { ShopAlertTopicStore } from "./shop-alert-topic.store.js";

let pools: { ownerPool: pg.Pool; shopPool: pg.Pool } | null = null;

async function ensurePools() {
  pools ??= await setupShopIntegrationPools();
  return pools;
}

async function createStores() {
  const { ownerPool, shopPool } = await ensurePools();
  await ownerPool.query(
    "TRUNCATE shop_alert_match, shop_alert_digest, shop_alert_topic, shop_alert_subscriber, shop_alert_announcement CASCADE",
  );
  const db = createShopDb(shopPool);
  return {
    db,
    subscribers: new ShopAlertSubscriberStore(db),
    topics: new ShopAlertTopicStore(db),
    matches: new ShopAlertMatchLedger(db),
    digests: new ShopAlertDigestLedger(db),
    announcements: new ShopAlertAnnouncementStore(db),
  };
}

afterAll(async () => {
  if (!pools) return;
  await pools.shopPool.end();
  await pools.ownerPool.end();
});

if (hasShopIntegrationDb) {
  describeAlertStoreContract("Postgres (LAX Shop)", "shop", createStores, {
    topic: "shop.releases",
  });
  describeAlertStoreContract("Postgres (lax.art)", "art", createStores, {
    topic: "art.followed_artists",
  });
} else {
  describe.skip("alert stores: Postgres (Shop)", () =>
    it("needs the Shop database", () => undefined));
}

const NOW = new Date("2026-11-04T08:00:00.000Z");
const consent = { consentText: "We'll email you.", consentSource: "shop_home" };

describe.skipIf(!hasShopIntegrationDb)("Shop alert adapters (integration)", () => {
  it("keeps a person's LAX Shop row and lax.art row apart", async () => {
    const { subscribers } = await createStores();
    const shop = await subscribers.savePending({
      product: "shop",
      email: "both@example.com",
      ...consent,
      now: NOW,
    });
    const art = await subscribers.saveConfirmedForAccount({
      product: "art",
      email: "both@example.com",
      subjectId: "subject-both",
      ...consent,
      now: NOW,
    });
    expect(art.id).not.toBe(shop.id);
    expect((await subscribers.findByEmail("shop", "both@example.com"))?.status).toBe("pending");
    expect((await subscribers.findBySubject("shop", "subject-both"))?.id).toBeUndefined();
    expect((await subscribers.findBySubject("art", "subject-both"))?.id).toBe(art.id);
  });

  it("finds a row by the hash of the stop token an older email carried", async () => {
    const { subscribers, db } = await createStores();
    const row = await subscribers.savePending({
      product: "shop",
      email: "legacy@example.com",
      ...consent,
      now: NOW,
    });
    const hash = createHash("sha256").update("legacy-stop-token", "utf8").digest("hex");
    await db
      .update(shopAlertSubscriber)
      .set({ legacyLinkHash: hash })
      .where(eq(shopAlertSubscriber.id, row.id));
    expect((await subscribers.findByLegacyLinkHash(hash))?.id).toBe(row.id);
    expect(await subscribers.findByLegacyLinkHash("0".repeat(64))).toBeNull();
  });

  it("only lists a product's subscribers for its own digest", async () => {
    const { subscribers, matches } = await createStores();
    const shop = await subscribers.saveConfirmedForAccount({
      product: "shop",
      email: "s@example.com",
      subjectId: "s",
      ...consent,
      now: NOW,
    });
    const art = await subscribers.saveConfirmedForAccount({
      product: "art",
      email: "a@example.com",
      subjectId: "a",
      ...consent,
      now: NOW,
    });
    await matches.record([
      {
        subscriberId: shop.id,
        topic: "shop.releases",
        itemKey: "artwork:1",
        groupKey: null,
        snapshot: { title: "A", path: "/artworks/a" },
        matchedAt: NOW,
      },
      {
        subscriberId: art.id,
        topic: "art.followed_artists",
        itemKey: "artwork:2",
        groupKey: "artist-1",
        snapshot: { title: "B", path: "/artworks/b" },
        matchedAt: NOW,
      },
    ]);
    expect(await matches.pendingSubscribers("shop", null, 10)).toEqual([shop.id]);
    expect(await matches.pendingSubscribers("art", null, 10)).toEqual([art.id]);
  });

  it("queues the confirmation and the digest on the shop outbox, each once, on the right stream", async () => {
    const { db } = await createStores();
    const mailer = new ShopAlertMailer(db);
    const to = `mail-${Date.now()}@example.com`;
    const confirmation = {
      product: "shop" as const,
      to,
      subscriberId: "sub-mail",
      requestedAtMs: 1234,
      confirmUrl: "https://shop.example/release-alerts/confirm?token=C",
      stopUrl: "https://shop.example/release-alerts/unsubscribe?token=S",
      oneClickUrl: "https://shop.example/release-alerts/unsubscribe?token=S",
      expirationHours: 48,
    };
    await mailer.sendConfirmation(confirmation);
    await mailer.sendConfirmation(confirmation);

    const vm = assembleDigest([
      {
        id: "m1",
        subscriberId: "sub-mail",
        topic: "art.followed_artists",
        itemKey: "artwork:1",
        groupKey: "artist-1",
        snapshot: { title: "Harbour light", path: "/artworks/harbour-light", groupLabel: "Iris" },
        matchedAt: NOW,
      },
    ]);
    if (!vm) throw new Error("no digest");
    const digest = {
      product: "art" as const,
      to,
      subscriberId: "sub-mail",
      localDate: "2026-11-04",
      idempotencyKey: `alert-digest:art:sub-mail:2026-11-04:${to}`,
      vm,
      activeTopics: ["art.followed_artists" as const],
      siteUrl: (path: string) => `https://lax.art${path}`,
      stopUrl: "https://lax.art/alerts/unsubscribe?token=S",
      oneClickUrl: "https://lax.art/alerts/unsubscribe?token=S",
      manageUrl: null,
      audience: "account" as const,
      viewerZone: null,
      changeZoneUrl: null,
    };
    await mailer.sendDigest(digest);
    await mailer.sendDigest(digest);

    const rows = await db
      .select({
        template: emailOutbox.template,
        stream: emailOutbox.stream,
        vars: emailOutbox.vars,
      })
      .from(emailOutbox)
      .where(eq(emailOutbox.toSnapshot, to));
    expect(rows.map((r) => [r.template, r.stream]).sort()).toEqual([
      ["alert-confirm", "transactional"],
      ["alert-digest", "broadcast"],
    ]);
    expect(rows.find((r) => r.template === "alert-digest")?.vars).toMatchObject({
      product: "art",
      subject: "New work: Harbour light",
    });
  });
});
